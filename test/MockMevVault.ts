import { ethers } from 'hardhat'
import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { time } from '@nomicfoundation/hardhat-network-helpers'

describe('MockMevVault', function () {
  let depositContract: Contract
  let slpDeposit: Contract
  let mevVault: Contract
  let withdrawalVault: Contract
  let slpCore: Contract
  let vETH1: Contract
  let vETH2: Contract
  let deployer: SignerWithAddress
  let newOwner: SignerWithAddress
  let attacker: SignerWithAddress
  let feeReceiver: SignerWithAddress
  let rewardPayer: SignerWithAddress
  let newRewardReceiver: SignerWithAddress

  beforeEach(async function () {
    ;[deployer, newOwner, attacker, feeReceiver, rewardPayer, newRewardReceiver] = await ethers.getSigners()

    const DepositContract = await ethers.getContractFactory('DepositContract')
    const VETH1 = await ethers.getContractFactory('vETH1')
    const VETH2 = await ethers.getContractFactory('vETH2')
    const SLPDeposit = await ethers.getContractFactory('MockSLPDeposit')
    const MevVault = await ethers.getContractFactory('MevVault')
    const WithdrawalVault = await ethers.getContractFactory('WithdrawalVault')
    const SLPCore = await ethers.getContractFactory('SLPCore')

    depositContract = await DepositContract.deploy()
    vETH1 = await VETH1.deploy()
    vETH2 = await VETH2.deploy()
    slpDeposit = await SLPDeposit.deploy()
    mevVault = await MevVault.deploy()
    withdrawalVault = await WithdrawalVault.deploy()
    slpCore = await SLPCore.deploy()

    const feeRate = 100
    await vETH2.setSLPCore(deployer.address)
    await vETH2.mint(deployer.address, ethers.utils.parseEther('1'))
    await slpDeposit.initialize(depositContract.address)
    await slpCore.initialize(
      vETH1.address,
      vETH2.address,
      slpDeposit.address,
      mevVault.address,
      withdrawalVault.address,
      feeReceiver.address,
      feeRate
    )
    await vETH2.setSLPCore(slpCore.address)
    await mevVault.initialize(slpDeposit.address)
    await mevVault.setSLPCore(slpCore.address)
  })

  it('basic check', async function () {
    const now = await time.latest()
    const reward = await mevVault.reward()
    expect(reward.total).to.equal(0)
    expect(reward.perDay).to.equal(0)
    expect(reward.paid).to.equal(0)
    expect(reward.pending).to.equal(0)
    expect(reward.lastPaidAt).to.equal(BigNumber.from(now).div(time.duration.days(1)).mul(time.duration.days(1)))
    expect(reward.finishAt).to.equal(BigNumber.from(now).div(time.duration.days(1)).mul(time.duration.days(1)))

    expect(await mevVault.slpCore()).to.equal(slpCore.address)
    expect(await mevVault.slpDeposit()).to.equal(slpDeposit.address)

    expect(await mevVault.REWARD_DURATION()).to.equal(30)
    expect(await mevVault.REWARD_DURATION_DAYS()).to.equal(time.duration.days(30))
  })

  it('transfer owner should be ok', async function () {
    await mevVault.transferOwnership(newOwner.address)
    expect(await mevVault.owner()).to.equal(newOwner.address)
  })

  it('transfer owner by attacker should revert', async function () {
    await expect(mevVault.connect(attacker).transferOwnership(newOwner.address)).to.revertedWith(
      'Ownable: caller is not the owner'
    )
  })

  describe('send reward', function () {
    it('send reward no overlap should be ok', async function () {
      const amount = ethers.utils.parseEther('1')
      await expect(
        rewardPayer.sendTransaction({
          to: mevVault.address,
          value: amount,
        })
      )
        .to.emit(mevVault, 'RewardReceived')
        .withArgs(rewardPayer.address, amount)

      let now = await time.latest()
      let reward = await mevVault.reward()
      expect(reward.total).to.equal(ethers.utils.parseEther('1'))
      expect(reward.perDay).to.equal(ethers.utils.parseEther('0.033333333333333333'))
      expect(reward.paid).to.equal(0)
      expect(reward.pending).to.equal(0)
      expect(reward.lastPaidAt).to.equal(BigNumber.from(now).div(time.duration.days(1)).mul(time.duration.days(1)))
      expect(reward.finishAt).to.equal(reward.lastPaidAt.add(time.duration.days(30)))

      const day = 31
      await time.increase(time.duration.days(day))
      await expect(
        rewardPayer.sendTransaction({
          to: mevVault.address,
          value: amount,
        })
      )
        .to.emit(mevVault, 'RewardReceived')
        .withArgs(rewardPayer.address, amount)

      now = await time.latest()
      reward = await mevVault.reward()
      expect(reward.total).to.equal(ethers.utils.parseEther('1').mul(2))
      expect(reward.perDay).to.equal(ethers.utils.parseEther('0.033333333333333333'))
      expect(reward.paid).to.equal(0)
      expect(reward.pending).to.equal(ethers.utils.parseEther('0.033333333333333333').mul(30))
      expect(reward.lastPaidAt).to.equal(BigNumber.from(now).div(time.duration.days(1)).mul(time.duration.days(1)))
      expect(reward.finishAt).to.equal(reward.lastPaidAt.add(time.duration.days(30)))
    })

    it('send reward overlap should be ok', async function () {
      const amount = ethers.utils.parseEther('1')
      await expect(
        rewardPayer.sendTransaction({
          to: mevVault.address,
          value: amount,
        })
      )
        .to.emit(mevVault, 'RewardReceived')
        .withArgs(rewardPayer.address, amount)

      let now = await time.latest()
      let reward = await mevVault.reward()
      expect(reward.total).to.equal(ethers.utils.parseEther('1'))
      expect(reward.perDay).to.equal(ethers.utils.parseEther('0.033333333333333333'))
      expect(reward.paid).to.equal(0)
      expect(reward.pending).to.equal(0)
      expect(reward.lastPaidAt).to.equal(BigNumber.from(now).div(time.duration.days(1)).mul(time.duration.days(1)))
      expect(reward.finishAt).to.equal(reward.lastPaidAt.add(time.duration.days(30)))

      const day = 15
      await time.increase(time.duration.days(day))
      await expect(
        rewardPayer.sendTransaction({
          to: mevVault.address,
          value: amount,
        })
      )
        .to.emit(mevVault, 'RewardReceived')
        .withArgs(rewardPayer.address, amount)

      now = await time.latest()
      reward = await mevVault.reward()
      expect(reward.total).to.equal(ethers.utils.parseEther('1').mul(2))
      // expect(reward.perDay).to.equal(
      //   ethers.utils.parseEther('0.033333333333333333').add(ethers.utils.parseEther('0.033333333333333333').div(2))
      // )
      expect(reward.paid).to.equal(0)
      expect(reward.pending).to.equal(ethers.utils.parseEther('0.033333333333333333').mul(day))
      expect(reward.lastPaidAt).to.equal(BigNumber.from(now).div(time.duration.days(1)).mul(time.duration.days(1)))
      expect(reward.finishAt).to.equal(reward.lastPaidAt.add(time.duration.days(30)))
    })

    it('send reward too low should revert', async function () {
      await expect(
        rewardPayer.sendTransaction({
          to: mevVault.address,
          value: 29,
        })
      ).revertedWith('Reward amount is too low')
    })
  })

  describe('addReward', function () {
    beforeEach(async function () {
      const amount = ethers.utils.parseEther('1')
      await expect(
        rewardPayer.sendTransaction({
          to: mevVault.address,
          value: amount,
        })
      )
        .to.emit(mevVault, 'RewardReceived')
        .withArgs(rewardPayer.address, amount)
    })

    it('addReward per day should be ok', async function () {
      // no reward
      await expect(mevVault.addReward())
        .to.emit(mevVault, 'RewardAdded')
        .withArgs(deployer.address, slpDeposit.address, 0)
      let reward = await mevVault.reward()
      expect(reward.paid).to.equal(ethers.utils.parseEther('0'))
      expect(await slpDeposit.getBalance()).to.equal(ethers.utils.parseEther('0'))

      // pay reward
      for (let i = 0; i < 30; i++) {
        await time.increase(time.duration.days(1))
        await expect(mevVault.addReward())
          .to.emit(mevVault, 'RewardAdded')
          .withArgs(deployer.address, slpDeposit.address, ethers.utils.parseEther('0.033333333333333333'))
      }
      reward = await mevVault.reward()
      expect(reward.paid).to.equal(ethers.utils.parseEther('0.999999999999999990'))
      expect(await slpDeposit.getBalance()).to.equal(ethers.utils.parseEther('0.999999999999999990'))

      // no reward
      await time.increase(time.duration.days(1))
      await expect(mevVault.addReward())
        .to.emit(mevVault, 'RewardAdded')
        .withArgs(deployer.address, slpDeposit.address, 0)
      reward = await mevVault.reward()
      expect(reward.paid).to.equal(ethers.utils.parseEther('0.999999999999999990'))
      expect(await slpDeposit.getBalance()).to.equal(ethers.utils.parseEther('0.999999999999999990'))
    })

    it('addReward per 10 day should be ok', async function () {
      // no reward
      await expect(mevVault.addReward())
        .to.emit(mevVault, 'RewardAdded')
        .withArgs(deployer.address, slpDeposit.address, 0)
      let reward = await mevVault.reward()
      expect(reward.paid).to.equal(ethers.utils.parseEther('0'))
      expect(await slpDeposit.getBalance()).to.equal(ethers.utils.parseEther('0'))

      // pay reward
      for (let i = 0; i < 3; i++) {
        await time.increase(time.duration.days(10))
        await expect(mevVault.addReward())
          .to.emit(mevVault, 'RewardAdded')
          .withArgs(deployer.address, slpDeposit.address, ethers.utils.parseEther('0.333333333333333330'))
      }
      reward = await mevVault.reward()
      expect(reward.paid).to.equal(ethers.utils.parseEther('0.999999999999999990'))
      expect(await slpDeposit.getBalance()).to.equal(ethers.utils.parseEther('0.999999999999999990'))

      // no reward
      await time.increase(time.duration.days(1))
      await expect(mevVault.addReward())
        .to.emit(mevVault, 'RewardAdded')
        .withArgs(deployer.address, slpDeposit.address, 0)
      reward = await mevVault.reward()
      expect(reward.paid).to.equal(ethers.utils.parseEther('0.999999999999999990'))
      expect(await slpDeposit.getBalance()).to.equal(ethers.utils.parseEther('0.999999999999999990'))
    })

    it('addReward one time should be ok', async function () {
      // no reward
      await expect(mevVault.addReward())
        .to.emit(mevVault, 'RewardAdded')
        .withArgs(deployer.address, slpDeposit.address, 0)
      let reward = await mevVault.reward()
      expect(reward.paid).to.equal(ethers.utils.parseEther('0'))
      expect(await slpDeposit.getBalance()).to.equal(ethers.utils.parseEther('0'))

      // pay reward
      await time.increase(time.duration.days(100))
      await expect(mevVault.addReward())
        .to.emit(mevVault, 'RewardAdded')
        .withArgs(deployer.address, slpDeposit.address, ethers.utils.parseEther('0.999999999999999990'))
      reward = await mevVault.reward()
      expect(reward.paid).to.equal(ethers.utils.parseEther('0.999999999999999990'))
      expect(await slpDeposit.getBalance()).to.equal(ethers.utils.parseEther('0.999999999999999990'))

      // no reward
      await time.increase(time.duration.days(100))
      await expect(mevVault.addReward())
        .to.emit(mevVault, 'RewardAdded')
        .withArgs(deployer.address, slpDeposit.address, 0)

      reward = await mevVault.reward()
      expect(reward.paid).to.equal(ethers.utils.parseEther('0.999999999999999990'))
      expect(await slpDeposit.getBalance()).to.equal(ethers.utils.parseEther('0.999999999999999990'))
    })

    it('addReward by attacker should revert', async function () {
      await expect(mevVault.connect(attacker).addReward()).revertedWith('Ownable: caller is not the owner')
    })
  })
})
