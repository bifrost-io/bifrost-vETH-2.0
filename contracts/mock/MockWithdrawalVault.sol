// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import {WithdrawalVault} from "../WithdrawalVault.sol";

contract MockWithdrawalVault is WithdrawalVault {
    bool public enableReceiveETH = true;

    // solhint-disable-next-line no-empty-blocks
    receive() external payable {
        require(enableReceiveETH);
    }

    function setETHReceive(bool enable) external onlyOwner {
        enableReceiveETH = enable;
    }
}
