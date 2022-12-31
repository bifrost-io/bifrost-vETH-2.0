// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/MerkleProofUpgradeable.sol";
import "./interfaces/IVETH.sol";
import "./interfaces/IDepositContract.sol";

// solhint-disable-next-line contract-name-camelcase
contract vETH2Claim is OwnableUpgradeable, ReentrancyGuardUpgradeable {
    /* ========== STATE VARIABLES ========== */

    address public vETH2;

    bytes32 public merkleRoot;

    mapping(address => bool) public claimed;

    /* ========== EVENTS ========== */

    event Claimed(address indexed sender, address target, uint256 amount);

    function initialize(address _vETH2, bytes32 _merkleRoot) public initializer {
        super.__Ownable_init();
        super.__ReentrancyGuard_init();

        vETH2 = _vETH2;
        merkleRoot = _merkleRoot;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function claim(address target, uint256 amount, bytes32[] memory proof) external nonReentrant {
        require(!claimed[target], "Claimed");
        claimed[target] = true;

        bytes32 leaf = keccak256(abi.encode(target, amount));
        require(MerkleProofUpgradeable.verify(proof, merkleRoot, leaf), "Merkle proof verification failed");

        IERC20Upgradeable(vETH2).transfer(target, amount);

        emit Claimed(msg.sender, target, amount);
    }
}
