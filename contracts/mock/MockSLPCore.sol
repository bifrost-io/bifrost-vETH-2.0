// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {SLPCore} from "../SLPCore.sol";

contract MockSLPCore is SLPCore {
    // solhint-disable-next-line no-empty-blocks
    receive() external payable {}
}
