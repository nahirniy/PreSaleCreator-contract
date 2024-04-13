// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract SolarGreen is ERC20, AccessControl {
    bytes32 public constant BLACKLISTER = keccak256("BLACKLISTER");

    uint public initiallySupply = 100000000 ether;

    mapping(address => bool) private _blacklist;

    event AddedToBlacklist(address indexed _address);
    event RemovedFromBlacklist(address indexed _address);
    event MintedNewToken(address _to, uint _amount);
    event BurnedToken(address _to, uint _amount);

    constructor(
        address _owner,
        address _blacklister
    ) ERC20("Solar Green", "SGR") {
        require(_owner != address(0), "owner address isnt correct");
        require(!_isContract(_owner), "owner address cant be a contract");
        require(_blacklister != address(0), "blacklister address isnt correct");
        require(!_isContract(_blacklister), "blacklister cant be contract");

        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
        _grantRole(BLACKLISTER, _blacklister);

        _mint(address(this), 50000000 ether);
    }

    /**
     * @dev Mint new tokens and allocate them to a specified account.
     * @param _to The address where the newly minted tokens will be allocated.
     * @param _amount The amount of tokens to mint.
     */
    function mint(
        address _to,
        uint256 _amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _mint(_to, _amount);

        emit MintedNewToken(_to, _amount);
    }

    /**
     * @dev Burn tokens from the contract's balance.
     * @param _amount The amount of tokens to burn.
     */
    function burn(
        address _from,
        uint _amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _burn(_from, _amount);

        emit BurnedToken(_from, _amount);
    }

    /**
     * @dev Determines whether the specified address contains contract code.
     * @param _address The address to be checked.
     * @return True if the address contains contract code, false otherwise.
     */
    function _isContract(address _address) internal view returns (bool) {
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(_address)
        }
        return codeSize > 0;
    }

    /**
     *@dev Assigns the role of a blacklister to a new address, granting authority to add addresses to the blacklist.
     *@param _account The address to be assigned the role of a blacklister.
     */
    function addBlacklister(
        address _account
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_account != address(0), "blacklister address isnt correct");
        require(!hasRole(BLACKLISTER, _account), "already blacklister");
        require(!_isContract(_account), "contract address cant be blacklister");

        _grantRole(BLACKLISTER, _account);
    }

    /**
     * @dev Removes the role of a blacklister from a specified address, thereby revoking their authority to manage the blacklist.
     * @param _account The address from which to remove the role of blacklister.
     */
    function removeBlacklister(
        address _account
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(hasRole(BLACKLISTER, _account), "doesnt have role blacklister");

        _revokeRole(BLACKLISTER, _account);
    }

    /**
     * @dev Adds the specified address to the blacklist.
     * @param _account The address to be added to the blacklist.
     */
    function addToBlacklist(address _account) external onlyRole(BLACKLISTER) {
        require(!hasRole(DEFAULT_ADMIN_ROLE, _account), "admin cant be in bl");
        require(!hasRole(BLACKLISTER, _account), "blackister cant be in bl");
        require(!_isContract(_account), "contract address cant be in bl");
        require(_account != address(0), "user address isnt correct");
        require(!_blacklist[_account], "already in blacklist");

        _blacklist[_account] = true;

        emit AddedToBlacklist(_account);
    }

    /**
     * @dev Removes the specified address from the blacklist.
     * @param _account The address to be removed from the blacklist.
     */
    function removeFromBlacklist(
        address _account
    ) external onlyRole(BLACKLISTER) {
        require(_blacklist[_account], "account isnt in the blacklist");

        _blacklist[_account] = false;

        emit RemovedFromBlacklist(_account);
    }

    /**
     * @dev Checks if the specified address is blacklisted.
     * @param _address The address to be checked.
     * @return Whether the address is blacklisted or not.
     */
    function isBlacklisted(address _address) external view returns (bool) {
        return _blacklist[_address];
    }

    /**
     * @dev Transfers tokens from the sender to the specified recipient.
     * @param _to The address to which tokens will be transferred.
     * @param _value The amount of tokens to transfer.
     * @return A boolean indicating whether the transfer was successful.
     * @notice Requires that the recipient is not blacklisted.
     */
    function transfer(address _to, uint _value) public override returns (bool) {
        require(!_blacklist[_to], "recipient is blocked");
        return super.transfer(_to, _value);
    }

    /**
     * @dev Transfers tokens on behalf of a token holder.
     * @param _from The address from which tokens will be transferred.
     * @param _to The address to which tokens will be transferred.
     * @param _value The amount of tokens to transfer.
     * @return A boolean indicating whether the transfer was successful.
     * @notice Requires that the recipient is not blacklisted.
     */
    function transferFrom(
        address _from,
        address _to,
        uint _value
    ) public override returns (bool) {
        require(!_blacklist[_to], "recipient is blocked");
        return super.transferFrom(_from, _to, _value);
    }
}
