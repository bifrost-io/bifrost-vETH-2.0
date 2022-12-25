// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/MerkleProofUpgradeable.sol";
import "./interfaces/IDepositContract.sol";

contract SLPDeposit is OwnableUpgradeable {
    /* solhint-disable var-name-mixedcase */
    struct Validator {
        bytes pubkey;
        bytes withdrawal_credentials;
        bytes signature;
        bytes32 deposit_data_root;
    }
    /* solhint-enable var-name-mixedcase */

    /* ========== STATE VARIABLES ========== */

    // address of Ethereum 2.0 Deposit Contract
    address public depositContract;
    // index => merkle root of withdrawal_credentials
    mapping(uint256 => bytes32) public merkleRoots;

    function initialize(address _depositContract) public initializer {
        super.__Ownable_init();

        depositContract = _depositContract;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function depositETH() external payable {}

    function batchDeposit(
        uint256 index,
        bytes32[] memory proof,
        bool[] memory proofFlags,
        Validator[] memory validators
    ) external onlyOwner {
        bytes32 root = merkleRoots[index];
        require(root != bytes32(0), "Merkle root not exists");

        bytes32[] memory leaves = new bytes32[](validators.length);
        for (uint256 i = 0; i < validators.length; i++) {
            leaves[i] = keccak256(validators[i].withdrawal_credentials);
        }
        require(
            MerkleProofUpgradeable.multiProofVerify(proof, proofFlags, root, leaves),
            "Merkle proof verification failed"
        );

        for (uint256 i = 0; i < validators.length; i++) {
            innerDeposit(validators[i]);
        }
    }

    function setMerkleRoot(uint256 index, bytes32 merkleRoot) external onlyOwner {
        require(merkleRoots[index] == bytes32(0), "Merkle root exists");
        require(merkleRoot != bytes32(0), "Invalid merkle root");
        merkleRoots[index] = merkleRoot;
    }

    /* ========== VIEWS ========== */

    function innerDeposit(Validator memory validator) private {
        uint amount = 32 ether;
        require(address(this).balance >= amount, "Insufficient balance");
        IDepositContract(depositContract).deposit{value: amount}(
            validator.pubkey,
            validator.withdrawal_credentials,
            validator.signature,
            validator.deposit_data_root
        );
    }
}
