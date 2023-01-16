// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// solhint-disable-next-line contract-name-camelcase
contract vETH2 is ERC20Pausable, Ownable {
    /* ========== STATE VARIABLES ========== */

    address public operator;

    // solhint-disable-next-line no-empty-blocks
    constructor() ERC20("Voucher Ethereum 2.0", "vETH") Pausable() Ownable() {
        operator = owner();
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function mint(address account, uint amount) external onlyOperator {
        super._mint(account, amount);
    }

    function burn(address account, uint amount) external onlyOwner {
        super._burn(account, amount);
    }

    function pause() external onlyOwner {
        super._pause();
    }

    function unpause() external onlyOwner {
        super._unpause();
    }

    function setOperator(address _operator) external onlyOwner {
        operator = _operator;
    }

    function transfer(address recipient, uint256 amount) public override whenNotPaused returns (bool) {
        return super.transfer(recipient, amount);
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public override whenNotPaused returns (bool) {
        return super.transferFrom(sender, recipient, amount);
    }

    /* ========== MODIFIER ========== */

    modifier onlyOperator() {
        require(msg.sender == operator, "Caller is not operator");
        _;
    }
}
