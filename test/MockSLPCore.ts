import { ethers } from 'hardhat'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

describe('MockSLPCore', function () {
  let depositContract: Contract
  let slpDeposit: Contract
  let slpCore: Contract
  let vETH1: Contract
  let vETH2: Contract
  let deployer: SignerWithAddress
  let newOwner: SignerWithAddress
  let operator: SignerWithAddress
  let newOperator: SignerWithAddress
  let attacker: SignerWithAddress
  let user1: SignerWithAddress
  let user2: SignerWithAddress
  let feeReceiver: SignerWithAddress
  let newFeeReceiver: SignerWithAddress
  const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD'

  beforeEach(async function () {
    ;[deployer, newOwner, operator, newOperator, attacker, user1, user2, feeReceiver, newFeeReceiver] =
      await ethers.getSigners()

    const DepositContract = await ethers.getContractFactory('DepositContract')
    const VETH1 = await ethers.getContractFactory('vETH1')
    const VETH2 = await ethers.getContractFactory('vETH2')
    const SLPDeposit = await ethers.getContractFactory('SLPDeposit')
    const SLPCore = await ethers.getContractFactory('MockSLPCore')

    depositContract = await DepositContract.deploy()
    vETH1 = await VETH1.deploy()
    vETH2 = await VETH2.deploy()
    slpDeposit = await SLPDeposit.deploy()
    slpCore = await SLPCore.deploy()

    const feeRate = 100
    await vETH2.mint(deployer.address, ethers.utils.parseEther('1'))
    await slpDeposit.initialize(depositContract.address)
    await slpCore.initialize(
      vETH1.address,
      vETH2.address,
      slpDeposit.address,
      operator.address,
      feeReceiver.address,
      feeRate
    )
    await vETH2.setOperator(slpCore.address)
  })

  it('basic check', async function () {
    const initTokenPoolAmount = ethers.utils.parseEther('1')
    const feeRate = 100
    expect(await vETH2.totalSupply()).to.equal(initTokenPoolAmount)
    expect(await slpCore.tokenPool()).to.equal(initTokenPoolAmount)
    expect(await slpCore.vETH1()).to.equal(vETH1.address)
    expect(await slpCore.vETH2()).to.equal(vETH2.address)
    expect(await slpCore.slpDeposit()).to.equal(slpDeposit.address)
    expect(await slpCore.operator()).to.equal(operator.address)
    expect(await slpCore.feeReceiver()).to.equal(feeReceiver.address)
    expect(await slpCore.feeRate()).to.equal(feeRate)
    expect(await slpCore.DEAD_ADDRESS()).to.equal(DEAD_ADDRESS)
    expect(await slpCore.FEE_RATE_DENOMINATOR()).to.equal(10000)
  })

  it('transfer owner should be ok', async function () {
    await slpCore.transferOwnership(newOwner.address)
    expect(await slpCore.owner()).to.equal(newOwner.address)
  })

  it('transfer owner by attacker should revert', async function () {
    await expect(slpCore.connect(attacker).transferOwnership(newOwner.address)).to.revertedWith(
      'Ownable: caller is not the owner'
    )
  })

  it('pause/unpause by owner should be ok', async function () {
    expect(await slpCore.paused()).to.equal(false)
    await slpCore.pause()
    expect(await slpCore.paused()).to.equal(true)
    await slpCore.unpause()
    expect(await slpCore.paused()).to.equal(false)
  })

  it('pause/unpause by attacker should revert', async function () {
    await expect(slpCore.connect(attacker).pause()).revertedWith('Ownable: caller is not the owner')
    await expect(slpCore.connect(attacker).unpause()).revertedWith('Ownable: caller is not the owner')
  })

  it('setFeeRate by owner should be ok', async function () {
    await slpCore.setFeeRate(200)
    expect(await slpCore.feeRate()).to.equal(200)
  })

  it('setFeeRate exceeds range should revert', async function () {
    await expect(slpCore.setFeeRate(10001)).to.revertedWith('Fee rate exceeds range')
  })

  it('setFeeRate by attacker should revert', async function () {
    await expect(slpCore.connect(attacker).setFeeRate(200)).to.revertedWith('Ownable: caller is not the owner')
  })

  it('setFeeReceiver by owner should be ok', async function () {
    await slpCore.setFeeReceiver(newFeeReceiver.address)
    expect(await slpCore.feeReceiver()).to.equal(newFeeReceiver.address)
  })

  it('setFeeReceiver by attacker should revert', async function () {
    await expect(slpCore.connect(attacker).setFeeReceiver(newFeeReceiver.address)).to.revertedWith(
      'Ownable: caller is not the owner'
    )
  })

  it('setOperator by owner should be ok', async function () {
    await slpCore.setOperator(newOperator.address)
    expect(await slpCore.operator()).to.equal(newOperator.address)
  })

  it('setOperator by attacker should revert', async function () {
    await expect(slpCore.connect(attacker).setOperator(newOperator.address)).to.revertedWith(
      'Ownable: caller is not the owner'
    )
  })

  describe('mint and renew', function () {
    beforeEach(async function () {
      await vETH2.transferOwnership(slpCore.address)
      await vETH1.mint(user1.address, ethers.utils.parseEther('100'))
      await vETH1.mint(user2.address, ethers.utils.parseEther('100'))
    })

    it('mint should be ok', async function () {
      const amount = ethers.utils.parseEther('1')
      await expect(slpCore.connect(user1).mint({ value: amount }))
        .to.emit(slpCore, 'Deposited')
        .withArgs(user1.address, amount, amount)
      expect(await vETH2.balanceOf(user1.address)).to.equal(amount)
      expect(await ethers.provider.getBalance(slpDeposit.address)).to.equal(amount)

      const amount2 = ethers.utils.parseEther('5')
      await expect(slpCore.connect(user1).mint({ value: amount2 }))
        .to.emit(slpCore, 'Deposited')
        .withArgs(user1.address, amount2, amount2)
      expect(await vETH2.balanceOf(user1.address)).to.equal(amount.add(amount2))
      expect(await ethers.provider.getBalance(slpDeposit.address)).to.equal(amount.add(amount2))
    })

    it('mint with zero amount should revert', async function () {
      const amount = ethers.utils.parseEther('0')
      await expect(slpCore.connect(user1).mint({ value: amount })).to.revertedWith('Zero amount')
    })

    it('mint when paused should revert', async function () {
      await slpCore.pause()
      const amount = ethers.utils.parseEther('1')
      await expect(slpCore.connect(user1).mint({ value: amount })).to.revertedWith('Pausable: paused')
    })

    it('renew should be ok', async function () {
      const amount = ethers.utils.parseEther('1')
      await vETH1.connect(user1).approve(slpCore.address, amount)
      await expect(slpCore.connect(user1).renew(amount))
        .to.emit(slpCore, 'Renewed')
        .withArgs(user1.address, amount, amount)
      expect(await vETH2.balanceOf(user1.address)).to.equal(amount)
      expect(await vETH1.balanceOf(DEAD_ADDRESS)).to.equal(amount)

      const amount2 = ethers.utils.parseEther('5')
      await vETH1.connect(user1).approve(slpCore.address, amount2)
      await expect(slpCore.connect(user1).renew(amount2))
        .to.emit(slpCore, 'Renewed')
        .withArgs(user1.address, amount2, amount2)
      expect(await vETH2.balanceOf(user1.address)).to.equal(amount.add(amount2))
      expect(await vETH1.balanceOf(DEAD_ADDRESS)).to.equal(amount.add(amount2))
    })

    it('renew with zero amount should revert', async function () {
      const amount = ethers.utils.parseEther('0')
      await expect(slpCore.connect(user1).renew(amount)).to.revertedWith('Zero amount')
    })

    it('renew when paused should revert', async function () {
      await slpCore.pause()
      const amount = ethers.utils.parseEther('1')
      await expect(slpCore.connect(user1).renew(amount)).to.revertedWith('Pausable: paused')
    })

    it('addReward should be ok', async function () {
      expect(await slpCore.calculateVTokenAmount(ethers.utils.parseEther('1'))).to.equal(ethers.utils.parseEther('1'))
      const reward = ethers.utils.parseEther('0.1')
      await expect(slpCore.connect(operator).addReward(reward))
        .to.emit(slpCore, 'RewardAdded')
        .withArgs(operator.address, reward, ethers.utils.parseEther('0.001'))
      expect(await slpCore.tokenPool()).to.equal(ethers.utils.parseEther('1.1'))
      expect(await vETH2.totalSupply()).to.equal(ethers.utils.parseEther('1.001'))
      expect(await slpCore.calculateVTokenAmount(ethers.utils.parseEther('1'))).to.equal(
        ethers.utils.parseEther('0.91')
      )

      const tokenAmount = ethers.utils.parseEther('1')
      const vTokenAmount = ethers.utils.parseEther('0.91')
      await expect(slpCore.connect(user1).mint({ value: tokenAmount }))
        .to.emit(slpCore, 'Deposited')
        .withArgs(user1.address, tokenAmount, vTokenAmount)
      expect(await vETH2.balanceOf(user1.address)).to.equal(vTokenAmount)
      expect(await ethers.provider.getBalance(slpDeposit.address)).to.equal(tokenAmount)

      await vETH1.connect(user2).approve(slpCore.address, tokenAmount)
      await expect(slpCore.connect(user2).renew(tokenAmount))
        .to.emit(slpCore, 'Renewed')
        .withArgs(user2.address, tokenAmount, vTokenAmount)
      expect(await vETH2.balanceOf(user2.address)).to.equal(vTokenAmount)
      expect(await vETH1.balanceOf(DEAD_ADDRESS)).to.equal(tokenAmount)
    })

    it('addReward by attacker should revert', async function () {
      await expect(slpCore.connect(attacker).addReward(1)).to.revertedWith('Caller is not operator')
    })

    it('removeReward should be ok', async function () {
      const reward = ethers.utils.parseEther('0.1')
      await expect(slpCore.connect(operator).removeReward(reward))
        .to.emit(slpCore, 'RewardRemoved')
        .withArgs(operator.address, reward)
      expect(await slpCore.tokenPool()).to.equal(ethers.utils.parseEther('0.9'))
      expect(await vETH2.totalSupply()).to.equal(ethers.utils.parseEther('1'))

      const tokenAmount = ethers.utils.parseEther('1')
      const vTokenAmount = 1111111111111111111n
      await expect(slpCore.connect(user1).mint({ value: tokenAmount }))
        .to.emit(slpCore, 'Deposited')
        .withArgs(user1.address, tokenAmount, vTokenAmount)
      expect(await vETH2.balanceOf(user1.address)).to.equal(vTokenAmount)
      expect(await ethers.provider.getBalance(slpDeposit.address)).to.equal(tokenAmount)

      await vETH1.connect(user2).approve(slpCore.address, tokenAmount)
      await expect(slpCore.connect(user2).renew(tokenAmount))
        .to.emit(slpCore, 'Renewed')
        .withArgs(user2.address, tokenAmount, vTokenAmount)
      expect(await vETH2.balanceOf(user2.address)).to.equal(vTokenAmount)
      expect(await vETH1.balanceOf(DEAD_ADDRESS)).to.equal(tokenAmount)
    })

    it('removeReward by attacker should revert', async function () {
      await expect(slpCore.connect(attacker).removeReward(1)).to.revertedWith('Caller is not operator')
    })
  })

  describe('withdrawal', function () {
    beforeEach(async function () {
      const amount = ethers.utils.parseEther('1')
      await expect(slpCore.connect(user1).mint({ value: amount }))
        .to.emit(slpCore, 'Deposited')
        .withArgs(user1.address, amount, amount)
      expect(await vETH2.balanceOf(user1.address)).to.equal(amount)
      expect(await ethers.provider.getBalance(slpDeposit.address)).to.equal(ethers.utils.parseEther('1'))

      await expect(slpCore.connect(user2).mint({ value: amount }))
        .to.emit(slpCore, 'Deposited')
        .withArgs(user2.address, amount, amount)
      expect(await vETH2.balanceOf(user2.address)).to.equal(amount)
      expect(await ethers.provider.getBalance(slpDeposit.address)).to.equal(ethers.utils.parseEther('2'))
    })

    it('increaseWithdrawalNodeNumber should be ok', async function () {
      await deployer.sendTransaction({
        to: slpCore.address,
        value: ethers.utils.parseEther('32'),
      })
      expect(await slpCore.withdrawalNodeNumber()).to.equal(0)
      await slpCore.connect(operator).increaseWithdrawalNodeNumber(1)
      expect(await slpCore.withdrawalNodeNumber()).to.equal(1)

      await deployer.sendTransaction({
        to: slpCore.address,
        value: ethers.utils.parseEther('320'),
      })
      await slpCore.connect(operator).increaseWithdrawalNodeNumber(10)
      expect(await slpCore.withdrawalNodeNumber()).to.equal(11)
    })

    it('increaseWithdrawalNodeNumber exceed total ETH should revert', async function () {
      await deployer.sendTransaction({
        to: slpCore.address,
        value: ethers.utils.parseEther('31.99999'),
      })
      await expect(slpCore.connect(operator).increaseWithdrawalNodeNumber(1)).to.revertedWith('Exceed total ETH')

      await deployer.sendTransaction({
        to: slpCore.address,
        value: ethers.utils.parseEther('320'),
      })
      await slpCore.connect(operator).increaseWithdrawalNodeNumber(10)
      expect(await slpCore.withdrawalNodeNumber()).to.equal(10)
      await expect(slpCore.connect(operator).increaseWithdrawalNodeNumber(1)).to.revertedWith('Exceed total ETH')
    })

    it('withdrawRequest and withdrawComplete should be ok', async function () {
      expect(await vETH2.totalSupply()).to.equal(ethers.utils.parseEther('3'))

      const vETHAmount = ethers.utils.parseEther('0.1')
      const ethAmount = ethers.utils.parseEther('0.1')
      await vETH2.connect(user1).approve(slpCore.address, vETHAmount)
      await expect(slpCore.connect(user1).withdrawRequest(vETHAmount))
        .to.emit(slpCore, 'WithdrawalRequested')
        .withArgs(user1.address, vETHAmount, ethAmount)

      const withdrawalUser1 = await slpCore.withdrawals(user1.address)
      expect(withdrawalUser1.pending).to.equal(ethers.utils.parseEther('0.1'))
      expect(withdrawalUser1.queued).to.equal(0)
      expect(await slpCore.queuedWithdrawal()).to.equal(ethers.utils.parseEther('0.1'))
      expect(await vETH2.totalSupply()).to.equal(ethers.utils.parseEther('2.9'))

      await vETH2.connect(user2).approve(slpCore.address, vETHAmount)
      await expect(slpCore.connect(user2).withdrawRequest(vETHAmount))
        .to.emit(slpCore, 'WithdrawalRequested')
        .withArgs(user2.address, vETHAmount, ethAmount)
      const withdrawalUser2 = await slpCore.withdrawals(user2.address)
      expect(withdrawalUser2.pending).to.equal(ethers.utils.parseEther('0.1'))
      expect(withdrawalUser2.queued).to.equal(ethers.utils.parseEther('0.1'))
      expect(await slpCore.queuedWithdrawal()).to.equal(ethers.utils.parseEther('0.2'))
      expect(await vETH2.totalSupply()).to.equal(ethers.utils.parseEther('2.8'))

      await deployer.sendTransaction({
        to: slpCore.address,
        value: ethers.utils.parseEther('32'),
      })

      await slpCore.connect(operator).increaseWithdrawalNodeNumber(1)

      expect(await slpCore.canWithdrawalAmount(user1.address)).to.equal(ethers.utils.parseEther('0.1'))
      expect(await slpCore.canWithdrawalAmount(user2.address)).to.equal(ethers.utils.parseEther('0.1'))

      await expect(slpCore.connect(user1).withdrawComplete(ethAmount))
        .to.emit(slpCore, 'WithdrawalCompleted')
        .withArgs(user1.address, ethAmount)

      await expect(slpCore.connect(user2).withdrawComplete(ethAmount))
        .to.emit(slpCore, 'WithdrawalCompleted')
        .withArgs(user2.address, ethAmount)
    })

    it('withdrawRequest and withdrawComplete should revert', async function () {
      const vETHAmount = ethers.utils.parseEther('0.1')
      const ethAmount = ethers.utils.parseEther('0.1')
      await vETH2.connect(user1).approve(slpCore.address, vETHAmount)
      await expect(slpCore.connect(user1).withdrawRequest(vETHAmount))
        .to.emit(slpCore, 'WithdrawalRequested')
        .withArgs(user1.address, vETHAmount, ethAmount)

      const withdrawalUser1 = await slpCore.withdrawals(user1.address)
      expect(withdrawalUser1.pending).to.equal(ethers.utils.parseEther('0.1'))
      expect(withdrawalUser1.queued).to.equal(0)
      expect(await slpCore.queuedWithdrawal()).to.equal(ethers.utils.parseEther('0.1'))
      expect(await vETH2.totalSupply()).to.equal(ethers.utils.parseEther('2.9'))

      await expect(slpCore.connect(user1).withdrawComplete(ethAmount)).revertedWith('Insufficient withdrawal amount')
    })
  })
})
