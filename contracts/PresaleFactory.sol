// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract PresaleFactory is Ownable {
    uint public presaleId;
    IERC20 public usdt;

    struct Presale {
        address saleToken;
        uint startAt;
        uint endsAt;
        uint price;
        uint availableTokens;
        uint limitPerUser;
        uint precision;
        uint vestingEndTime;
        bool saleActive;
        bool startSale;
    }

    mapping(uint => Presale) public presale;
    mapping(uint => mapping(address => uint)) private _userVesting;

    AggregatorV3Interface internal aggregatorInterface;

    event PresaleCreated(
        uint indexed _id,
        uint _totalSupply,
        uint _startAt,
        uint _endsAt,
        address _token
    );

    event Bought(
        address _buyer,
        address _token,
        uint _amountTokens,
        uint _timestamp,
        uint indexed _id
    );

    event Claimed(
        address _holder,
        address _token,
        uint _amountTokens,
        uint _timestamp,
        uint indexed _id
    );

    event UpdatedTokenPrice(uint prevPrice, uint newPrice, uint timestamp);

    event PresalePaused(uint indexed _id, uint _timestamp);
    event PresaleUnpaused(uint indexed _id, uint _timestamp);

    event UpdatedSaleEnd(uint indexed _id, uint _newTime, uint _timestamp);
    event UpdatedVestingEnd(uint indexed _id, uint _newTime, uint _timestamp);

    event WithdrawUSDT(address _to, uint _amount, uint _timestamp);
    event WithdrawETH(address _to, uint _amount, uint _timestamp);
    event WithdrawPresaleToken(
        uint indexed _id,
        address _to,
        address _token,
        uint _amount,
        uint _timestamp
    );

    constructor(
        address _oracle,
        address _usdt,
        address _owner
    ) Ownable(_owner) {
        require(_oracle != address(0), "invalid oracle address");
        require(_usdt != address(0), "invalid USDT address");
        require(_owner != address(0), "invalid owner address");
        require(_isContract(_oracle), "oracle must be contract address");
        require(_isContract(_usdt), "USDT must be contract address");
        require(!_isContract(_owner), "owner cant be contract address");

        aggregatorInterface = AggregatorV3Interface(_oracle);
        usdt = IERC20(_usdt);
    }

    modifier checkPresaleId(uint _id) {
        require(_id > 0 && _id <= presaleId, "invalid presale id");
        _;
    }

    /**
     * @dev Checks whether the specified address contains contract code.
     * @param _address The address to be checked.
     * @return True if the address contains contract code, false otherwise.
     */
    function _isContract(address _address) internal view returns (bool) {
        uint codeSize;
        assembly {
            codeSize := extcodesize(_address)
        }
        return codeSize > 0;
    }

    /**
     * @dev Verifies the purchase parameters to ensure that the purchase is valid.
     * @param _id The ID of the presale.
     * @param _amountTokens The number of tokens being purchased.
     * @param _buyer The address of the buyer.
     */
    function _verifyPurchase(
        uint _id,
        uint _amountTokens,
        address _buyer
    ) internal view {
        require(
            block.timestamp >= presale[_id].startAt &&
                block.timestamp <= presale[_id].endsAt &&
                presale[_id].saleActive &&
                presale[_id].startSale,
            "sale is not active"
        );
        require(
            _userVesting[_id][_buyer] + _amountTokens <=
                presale[_id].limitPerUser,
            "cant buy more than limit per user"
        );
        require(
            _amountTokens <= presale[_id].availableTokens,
            "not enough tokens"
        );
        require(_amountTokens > 0, "not enough funds!");
    }

    /**
     * @dev Executes the purchase of tokens and updates the relevant data accordingly.
     * @param _id The ID of the presale.
     * @param _amountTokens The number of tokens being purchased.
     * @param _buyer The address of the buyer.
     */
    function _tokenPurchase(
        uint _id,
        uint _amountTokens,
        address _buyer
    ) internal {
        presale[_id].availableTokens -= _amountTokens;
        _userVesting[_id][_buyer] += _amountTokens;

        emit Bought(
            _buyer,
            presale[_id].saleToken,
            _amountTokens,
            block.timestamp,
            _id
        );
    }

    /**
     * @dev Creates a new presale with the specified parameters.
     * @param _saleToken The address of the token being sold in the presale.
     * @param _startTime The start time of the presale.
     * @param _endTime The end time of the presale.
     * @param _tokenPrice The price of each token in the presale.
     * @param _availableTokens The total number of tokens available for sale in the presale.
     * @param _limitPerUser The maximum number of tokens each user can purchase in the presale.
     * @param _precision The precision of the token price (e.g., number of decimal places).
     * @param _vestingEndTime The end time for vesting of purchased tokens.
     */
    function createPresale(
        address _saleToken,
        uint _startTime,
        uint _endTime,
        uint _tokenPrice,
        uint _availableTokens,
        uint _limitPerUser,
        uint _precision,
        uint _vestingEndTime
    ) external onlyOwner {
        bool _saleActive = false;
        bool _startSale = false;

        require(
            _startTime > block.timestamp && _endTime > _startTime,
            "time isnt correct"
        );
        require(_saleToken != address(0), "token address cant be zero");
        require(_isContract(_saleToken), "token must be contract address");
        require(_tokenPrice > 0, "token price cant be zero");
        require(_availableTokens > 0, "zero tokens to sell");
        require(_limitPerUser > 0, "zero tokens limit for user");
        require(_precision > 0, "precision cant be zero");
        require(_vestingEndTime >= _endTime, "vesting time end isnt correct");

        presaleId++;

        presale[presaleId] = Presale(
            _saleToken,
            _startTime,
            _endTime,
            _tokenPrice,
            _availableTokens,
            _limitPerUser,
            _precision,
            _vestingEndTime,
            _saleActive,
            _startSale
        );

        emit PresaleCreated(
            presaleId,
            _availableTokens,
            _startTime,
            _endTime,
            _saleToken
        );
    }

    /**
     * @dev Starts the presale with the specified ID.
     * @param _id The ID of the presale to start.
     * Requirements:
     * - The presale must not have already started.
     * - There must be tokens available for sale in the contract.
     * - The initial supply of tokens must match the available tokens for sale.
     */
    function startSale(uint _id) external checkPresaleId(_id) onlyOwner {
        IERC20 token = IERC20(presale[_id].saleToken);

        require(!presale[_id].startSale, "presale has already started");
        require(
            token.balanceOf(address(this)) > 0,
            "no tokens available for sale"
        );
        require(
            token.balanceOf(address(this)) == presale[_id].availableTokens,
            "incorrect initial supply for sale"
        );

        presale[_id].startSale = true;
        presale[_id].saleActive = true;
    }

    /**
     * @dev Pauses the presale with the specified ID.
     * @param _id The ID of the presale to pause.
     * Requirements:
     * - The presale must be currently active.
     */
    function pausePresale(uint _id) external checkPresaleId(_id) onlyOwner {
        require(presale[_id].startSale, "sale hasnt started yet");
        require(presale[_id].saleActive, "already paused");

        presale[_id].saleActive = false;
        emit PresalePaused(_id, block.timestamp);
    }

    /**
     * @dev Pauses the presale with the specified ID.
     * @param _id The ID of the presale to unpause.
     * Requirements:
     * - The presale must be currently paused.
     */
    function unPausePresale(uint _id) external checkPresaleId(_id) onlyOwner {
        require(presale[_id].startSale, "sale hasnt started yet");
        require(!presale[_id].saleActive, "not paused");

        presale[_id].saleActive = true;
        emit PresaleUnpaused(_id, block.timestamp);
    }

    /**
     * @dev Retrieves the token balance of a user for a specific presale.
     * @param _id The ID of the presale.
     * @param _user The address of the user.
     * @return The token balance of the user for the specified presale.
     * Requirements:
     * - The presale ID must be valid.
     */
    function checkUserBalance(
        uint _id,
        address _user
    ) external view checkPresaleId(_id) returns (uint) {
        return _userVesting[_id][_user];
    }

    /**
     * @dev Retrieves the remaining token balance of the presale contract for a specific presale.
     * @param _id The ID of the presale.
     * @return The remaining token balance of the presale contract for the specified presale.
     * Requirements:
     * - The presale ID must be valid.
     */
    function presaleTokenBalance(
        uint _id
    ) public view checkPresaleId(_id) returns (uint) {
        IERC20 token = IERC20(presale[_id].saleToken);

        return token.balanceOf(address(this));
    }

    /**
     * @dev Retrieves the current Ether balance of the contract.
     * @return The current Ether balance of the contract.
     */
    function ethBalance() public view returns (uint) {
        return address(this).balance;
    }

    /**
     * @dev Retrieves the current USDT balance of the contract.
     * @return The current USDT balance of the contract.
     */
    function usdtBalance() public view returns (uint) {
        return usdt.balanceOf(address(this));
    }

    /**
     * @dev Updates the token price for a specific presale.
     * @param _id The ID of the presale.
     * @param _newPrice The new price for the presale token.
     * Requirements:
     * - The new price must be greater than zero.
     */
    function updateTokenPrice(
        uint _id,
        uint _newPrice
    ) external checkPresaleId(_id) onlyOwner {
        require(_newPrice > 0, "zero price");
        uint _prevValue = presale[_id].price;

        presale[_id].price = _newPrice;
        emit UpdatedTokenPrice(_prevValue, _newPrice, block.timestamp);
    }

    /**
     * @dev Sets the end time for a presale.
     * @param _id The ID of the presale.
     * @param _endsAt The new end time for the presale.
     * Requirements:
     * - The end time must be after the start time of the presale.
     */
    function setSaleEndTime(
        uint _id,
        uint _endsAt
    ) external checkPresaleId(_id) onlyOwner {
        require(presale[_id].startAt < _endsAt, "the end cant be before start");

        presale[_id].endsAt = _endsAt;
        emit UpdatedSaleEnd(_id, _endsAt, block.timestamp);
    }

    /**
     * @dev Sets the end time for vesting in a presale.
     * @param _id The ID of the presale.
     * @param _vestingEndTime The new end time for vesting in the presale.
     * Requirements:
     * - The vesting end time must be after the end time of the presale.
     */
    function setVestingEndTime(
        uint _id,
        uint _vestingEndTime
    ) external checkPresaleId(_id) onlyOwner {
        require(
            presale[_id].endsAt < _vestingEndTime,
            "vesting end cant be before the end sale"
        );

        presale[_id].vestingEndTime = _vestingEndTime;
        emit UpdatedVestingEnd(_id, _vestingEndTime, block.timestamp);
    }

    /**
     * @dev Retrieves the allowance granted by the caller to the contract for spending their USDT tokens.
     * @return value The allowance granted by the caller to the contract.
     */
    function getAllowance() internal view returns (uint value) {
        value = usdt.allowance(msg.sender, address(this));
    }

    /**
     * @dev Retrieves the latest price from the price oracle interface.
     * @return The latest price retrieved from the oracle.
     */
    function getLatestPrice() public view returns (uint) {
        (, int price, , , ) = aggregatorInterface.latestRoundData();
        require(price >= 0, "price cannot be negative");
        price = (price * 10 ** 10);
        return uint(price);
    }

    /**
     * @dev Calculates the equivalent USD price for a given amount of tokens based on the presale price and precision.
     * @param _id The ID of the presale.
     * @param _amount The number of tokens to calculate the price for.
     * @return usdPrice The calculated USD price for the specified number of tokens.
     */
    function usdtBuyHelper(
        uint _id,
        uint _amount
    ) public view checkPresaleId(_id) returns (uint usdPrice) {
        usdPrice = (_amount * presale[_id].price) / presale[_id].precision;
    }

    /**
     * @dev Calculates the equivalent amount of ETH required to purchase a given number of tokens in a presale.
     * @param _id The ID of the presale.
     * @param _amount The number of tokens to calculate the ETH price for.
     * @return ethAmount The calculated ETH amount required to purchase the specified number of tokens.
     */
    function ethBuyHelper(
        uint _id,
        uint _amount
    ) public view checkPresaleId(_id) returns (uint ethAmount) {
        uint usdPrice = usdtBuyHelper(_id, _amount);
        ethAmount = (usdPrice * presale[_id].precision) / getLatestPrice();
    }

    /**
     * @dev Allows users to purchase tokens in a presale using USDT.
     * @param _id The ID of the presale.
     * @param _amount The number of tokens to purchase.
     */
    function buyWithUSDT(uint _id, uint _amount) external checkPresaleId(_id) {
        _verifyPurchase(_id, _amount, msg.sender);

        uint usdPrice = usdtBuyHelper(_id, _amount);
        require(getAllowance() >= usdPrice, "not approved enough tokens");

        usdt.transferFrom(msg.sender, address(this), usdPrice);

        _tokenPurchase(_id, _amount, msg.sender);
    }

    /**
     * @dev Allows users to purchase tokens in a presale using ETH.
     * @param _id The ID of the presale.
     * @param _amount The number of tokens to purchase.
     */
    function buyWithEth(
        uint _id,
        uint _amount
    ) external payable checkPresaleId(_id) {
        _verifyPurchase(_id, _amount, msg.sender);

        uint ethAmount = ethBuyHelper(_id, _amount);
        require(msg.value >= ethAmount, "less payment");

        uint excess = msg.value - ethAmount;
        if (excess > 0) payable(msg.sender).transfer(excess);

        _tokenPurchase(_id, _amount, msg.sender);
    }

    /**
     * @dev Allows the holder of vested tokens to claim them after the vesting period has ended.
     * @param _id The ID of the presale.
     * @param _holder The address of the token holder.
     */
    function claimToken(
        uint _id,
        address _holder
    ) external checkPresaleId(_id) {
        IERC20 token = IERC20(presale[_id].saleToken);

        require(
            block.timestamp > presale[_id].vestingEndTime,
            "token claim will be allowed after vesting end"
        );

        uint _userTokens = _userVesting[_id][_holder];
        require(_userTokens > 0, "zero claim amount");

        token.transfer(_holder, _userTokens);
        _userVesting[_id][_holder] -= _userTokens;

        emit Claimed(
            _holder,
            presale[_id].saleToken,
            _userTokens,
            block.timestamp,
            _id
        );
    }

    /**
     * @dev Allows the owner to withdraw ETH from the contract.
     * @param _to The address to which ETH will be transferred.
     * @param _amount The amount of ETH to withdraw.
     * @notice Requires that the contract has sufficient ETH balance.
     */
    function withdrawETH(address _to, uint _amount) external onlyOwner {
        require(ethBalance() >= _amount, "insufficient ETH balance");

        payable(_to).transfer(_amount);
        emit WithdrawETH(_to, _amount, block.timestamp);
    }

    /**
     * @dev Allows the owner to withdraw USDT from the contract.
     * @param _to The address to which USDT will be transferred.
     * @param _amount The amount of USDT to withdraw.
     * @notice Requires that the contract has sufficient USDT balance.
     */
    function withdrawUSDT(address _to, uint _amount) external onlyOwner {
        require(usdtBalance() >= _amount, "insufficient USDT balance");

        usdt.transfer(_to, _amount);
        emit WithdrawUSDT(_to, _amount, block.timestamp);
    }

    /**
     * @dev Allows the owner to withdraw tokens from the presale contract.
     * @param _id The ID of the presale from which tokens will be withdrawn.
     * @param _amount The amount of tokens to withdraw.
     * @notice Requires that the presale has sufficient token balance.
     */
    function withdrawPresaleToken(
        uint _id,
        uint _amount,
        address _to
    ) external checkPresaleId(_id) onlyOwner {
        require(
            presale[_id].availableTokens >= _amount,
            "insufficient token balance"
        );
        IERC20 token = IERC20(presale[_id].saleToken);

        token.transfer(_to, _amount);
        presale[_id].availableTokens -= _amount;

        emit WithdrawPresaleToken(
            _id,
            _to,
            presale[_id].saleToken,
            _amount,
            block.timestamp
        );
    }
}
