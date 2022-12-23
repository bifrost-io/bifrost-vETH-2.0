// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract vETH2 is ERC20Pausable, Ownable {
    constructor() ERC20("Voucher Ethereum 2.0", "vETH2") Pausable() Ownable() {}

    function mint(address account, uint amount) external onlyOwner {
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

    function transfer(address recipient, uint256 amount) public override returns (bool) {
        require(!super.paused(), "vETH: transfer while paused");
        return super.transfer(recipient, amount);
    }

    function transferFrom(address sender, address recipient, uint256 amount) public override returns (bool) {
        require(!super.paused(), "vETH: transfer while paused");
        return super.transferFrom(sender, recipient, amount);
    }
}
