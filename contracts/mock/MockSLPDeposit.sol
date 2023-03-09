// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import {SLPDeposit} from "../SLPDeposit.sol";

contract MockSLPDeposit is SLPDeposit {
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
