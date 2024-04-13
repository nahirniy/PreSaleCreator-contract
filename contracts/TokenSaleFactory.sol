// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract TokenSaleFactory is Ownable {
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

    function _isContract(address _address) internal view returns (bool) {
        uint codeSize;
        assembly {
            codeSize := extcodesize(_address)
        }
        return codeSize > 0;
    }

    function _verifyPurchase(
        uint _id,
        uint _amountTokens,
        address _buyer
    ) internal view {
        require(
            block.timestamp >= presale[_id].startAt &&
                block.timestamp <= presale[_id].endsAt &&
                presale[_id].saleActive,
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
            _saleActive
        );

        emit PresaleCreated(
            presaleId,
            _availableTokens,
            _startTime,
            _endTime,
            _saleToken
        );
    }

    function startSale(uint _id) external checkPresaleId(_id) onlyOwner {
        IERC20 token = IERC20(presale[_id].saleToken);

        require(!presale[_id].saleActive, "presale has already started");
        require(
            token.balanceOf(address(this)) > 0,
            "no tokens available for sale"
        );
        require(
            token.balanceOf(address(this)) == presale[_id].availableTokens,
            "incorrect initial supply for sale"
        );

        presale[_id].saleActive = true;
    }

    function pausePresale(uint _id) external checkPresaleId(_id) onlyOwner {
        require(presale[_id].saleActive, "already paused");

        presale[_id].saleActive = true;
        emit PresalePaused(_id, block.timestamp);
    }

    function unPausePresale(uint _id) external checkPresaleId(_id) onlyOwner {
        require(!presale[_id].saleActive, "not paused");

        presale[_id].saleActive = false;
        emit PresaleUnpaused(_id, block.timestamp);
    }

    function updateTokenPrice(
        uint _id,
        uint _newPrice
    ) external checkPresaleId(_id) onlyOwner {
        require(_newPrice > 0, "zero price");
        uint _prevValue = presale[_id].price;

        presale[_id].price = _newPrice;
        emit UpdatedTokenPrice(_prevValue, _newPrice, block.timestamp);
    }

    function setSaleEndTime(
        uint _id,
        uint _endsAt
    ) external checkPresaleId(_id) onlyOwner {
        require(presale[_id].startAt < _endsAt, "the end cant be before start");

        presale[_id].endsAt = _endsAt;
        emit UpdatedSaleEnd(_id, _endsAt, block.timestamp);
    }

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

    function getAllowance() internal view returns (uint value) {
        value = usdt.allowance(msg.sender, address(this));
    }

    function getLatestPrice() public view returns (uint) {
        (, int price, , , ) = aggregatorInterface.latestRoundData();
        require(price >= 0, "price cannot be negative");
        price = (price * 10 ** 10);
        return uint(price);
    }

    function usdtBuyHelper(
        uint _id,
        uint _amount
    ) public view checkPresaleId(_id) returns (uint usdPrice) {
        usdPrice = (_amount * presale[_id].price) / presale[_id].precision;
    }

    function ethBuyHelper(
        uint _id,
        uint _amount
    ) public view checkPresaleId(_id) returns (uint ethAmount) {
        uint usdPrice = usdtBuyHelper(_id, _amount);
        ethAmount = (usdPrice * presale[_id].precision) / getLatestPrice();
    }

    function buyWithUSDT(uint _id, uint _amount) external checkPresaleId(_id) {
        _verifyPurchase(_id, _amount, msg.sender);

        uint usdPrice = usdtBuyHelper(_id, _amount);
        require(getAllowance() >= usdPrice, "not approved enough tokens");

        usdt.transferFrom(msg.sender, address(this), usdPrice);

        _tokenPurchase(_id, _amount, msg.sender);
    }

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
}
