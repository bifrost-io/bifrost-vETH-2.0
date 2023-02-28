// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

// solhint-disable-next-line contract-name-camelcase
contract vETH1 is ERC20, Ownable {
    // solhint-disable-next-line no-empty-blocks
    constructor() ERC20("Voucher Ethereum", "vETH") Ownable() {}

    function mint(address account, uint amount) external onlyOwner {
        super._mint(account, amount);
    }
}
