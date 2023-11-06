import { task } from 'hardhat/config'
import { SSVKeys, KeyShares } from 'ssv-keys'
import path from 'path'
import fs from 'fs'
import operators from '../data/operators.json'
import ssvClusterData from '../data/ssv_cluster.json'

task('ssv-key', 'Get SSV validator payload', async (args, { ethers, network }) => {
  const dir = './tasks/data/validator_keys'
  const fileList = fs.readdirSync(dir).filter((file) => file.startsWith('keystore'))
  // These can be either provided by the user (Staking-as-a-Service) or auto-generated (Staking Pool)
  const keystorePassword = ''
  const file = fileList[1]
  const keystore = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'))

  // 1. Initialize SSVKeys SDK and read the keystore file
  const ssvKeys = new SSVKeys()
  const { publicKey, privateKey } = await ssvKeys.extractKeys(keystore, keystorePassword)

  // 2. Build shares from operator IDs and public keys
  const encryptedShares = await ssvKeys.buildShares(privateKey, operators)
  const keyShares = new KeyShares()
  keyShares.update({ operators })
  keyShares.update({ ownerAddress: ssvClusterData.owner, ownerNonce: ssvClusterData.nonce, publicKey })

  // 3. Build final web3 transaction payload and update keyshares file with payload data
  await keyShares.buildPayload(
    {
      publicKey,
      operators,
      encryptedShares,
    },
    {
      ownerAddress: ssvClusterData.owner,
      ownerNonce: ssvClusterData.nonce,
      privateKey,
    }
  )

  fs.writeFileSync('./tasks/data/ssv_key.json', keyShares.toJson())
})
