// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import {WithdrawalVault} from "../WithdrawalVault.sol";

contract MockWithdrawalVault is WithdrawalVault {
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // solhint-disable-next-line no-empty-blocks
    receive() external payable {}
}
