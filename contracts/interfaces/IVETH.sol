// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

interface IVETH {
    function mint(address account, uint amount) external;

    function burn(address account, uint amount) external;

    function unpause() external;

    function paused() external view returns (bool);
}
