// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/MerkleProofUpgradeable.sol";
import "./interfaces/IVETH.sol";
import "./interfaces/IDepositContract.sol";

contract Claim is OwnableUpgradeable {
    /* ========== STATE VARIABLES ========== */

    address public vETH2;

    bytes32 public merkleRoot;

    mapping(address => bool) public claimed;

    /* ========== EVENTS ========== */

    event Claimed(address indexed sender, uint256 amount);

    function initialize(address _vETH2, bytes32 _merkleRoot) public initializer {
        super.__Ownable_init();

        vETH2 = _vETH2;
        merkleRoot = _merkleRoot;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function claim(uint256 amount, bytes32[] memory proof) external {
        require(!claimed[msg.sender], "Claimed");
        claimed[msg.sender] = true;

        bytes32 leaf = keccak256(abi.encode(msg.sender, amount));
        require(MerkleProofUpgradeable.verify(proof, merkleRoot, leaf), "Merkle proof verification failed");

        IERC20Upgradeable(vETH2).transfer(msg.sender, amount);

        emit Claimed(msg.sender, amount);
    }
}
