const { time, loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const { expect } = require('chai');
const hre = require('hardhat');

describe('Staking', function () {
    let rewardPerSecond = ethers.utils.parseUnits('0.01', 18);
    let startTime = getTimestampInSeconds() + 1000;
    let endTime = startTime + 10000;
    let tokenCounts = ethers.utils.parseUnits('1000000', 18);
    let userBalance = ethers.utils.parseUnits('10000', 18);
    let userDeposit = ethers.utils.parseUnits('100', 18);
    let oneToken = ethers.utils.parseUnits('1', 18);

    async function deployStakingFixture() {
        // Contracts are deployed using the first signer/account by default
        const accounts = await ethers.getSigners();
        const Mock = await hre.ethers.getContractFactory('Metacrypt_B_NC_X');
        const mock = await Mock.deploy(accounts[0].address, 'Teh Fund', 'FUND', tokenCounts);
        await mock.deployed();

        const Staking = await hre.ethers.getContractFactory('Staking');
        const staking = await Staking.deploy(mock.address, rewardPerSecond, startTime, endTime);
        await staking.deployed();

        await sendTokenAndMakeApprove(staking, mock, await ethers.getSigners());

        return { staking, mock, accounts };
    }

    async function sendTokenAndMakeApprove(staking, mock, accounts) {
        for (const account of accounts) {
            await mock.transfer(account.address, userBalance);
            await mock.connect(account).approve(staking.address, userBalance);
        }
    }

    describe('Deployment', function () {
        it('Should set the right token', async function () {
            const { staking, mock } = await loadFixture(deployStakingFixture);

            expect(await staking.token()).to.equal(mock.address);
        });

        it('Should set the right start time', async function () {
            const { staking } = await loadFixture(deployStakingFixture);

            expect(await staking.startTime()).to.equal(startTime);
        });

        it('Should set the right end time', async function () {
            const { staking } = await loadFixture(deployStakingFixture);

            expect(await staking.endTime()).to.equal(endTime);
        });

        it('Should set the right last reward time', async function () {
            const { staking } = await loadFixture(deployStakingFixture);

            expect(await staking.lastRewardTime()).to.be.eq(startTime);
        });

        it('Should set the right reward per second', async function () {
            const { staking } = await loadFixture(deployStakingFixture);

            expect(await staking.rewardPerSecond()).to.equal(rewardPerSecond);
        });
    });

    describe('Deposits', function () {
        it('Should deposit', async function () {
            const {
                staking,
                mock,
                accounts: [, user1],
            } = await loadFixture(deployStakingFixture);

            await time.increase(1000);
            await expect(staking.connect(user1).deposit(userDeposit)).to.changeTokenBalances(
                mock,
                [user1.address, staking.address],
                [userDeposit.mul(-1), userDeposit]
            );

            let userInfo = await staking.userInfo(user1.address);
            expect(userInfo.amount).to.be.eq(userDeposit);
            expect(userInfo.rewardDebt).to.be.eq(0);
            expect(userInfo.rewardDue).to.be.eq(0);
            expect(userInfo.stakedTime).to.be.eq(await time.latest());

            expect(await staking.lastRewardTime()).to.be.eq(await time.latest());
            expect(await staking.totalStake()).to.be.eq(userDeposit);
        });

        it('Should redeposit', async function () {
            const {
                staking,
                mock,
                accounts: [, user1],
            } = await loadFixture(deployStakingFixture);

            await time.increase(1000);
            await staking.connect(user1).deposit(userDeposit);
            let stakeTime = await time.latest();

            await time.increase(99);
            await expect(staking.connect(user1).deposit(userDeposit)).to.changeTokenBalances(
                mock,
                [user1.address, staking.address],
                [userDeposit.mul(-1), userDeposit]
            );

            let userInfo = await staking.userInfo(user1.address);
            expect(userInfo.amount).to.be.eq(userDeposit.mul(2));
            expect(userInfo.rewardDebt).to.be.eq(oneToken.mul(2));
            expect(userInfo.rewardDue).to.be.eq(oneToken);
            expect(userInfo.stakedTime).to.be.eq(stakeTime);

            expect(await staking.lastRewardTime()).to.be.eq(await time.latest());
            expect(await staking.totalStake()).to.be.eq(userDeposit.mul(2));
        });

        it('Should emit event on deposit', async function () {
            const {
                staking,
                mock,
                accounts: [, user1],
            } = await loadFixture(deployStakingFixture);

            await time.increase(1000);
            await expect(staking.connect(user1).deposit(userDeposit))
                .to.emit(staking, 'Deposit')
                .withArgs(user1.address, userDeposit);
        });

        it('Should fail if time not started yet', async function () {
            const {
                staking,
                mock,
                accounts: [, user1],
            } = await loadFixture(deployStakingFixture);

            await expect(staking.connect(user1).deposit(100)).to.be.revertedWith('Not allowed to deposit');
        });

        it('Should fail if time is over', async function () {
            const {
                staking,
                mock,
                accounts: [, user1],
            } = await loadFixture(deployStakingFixture);

            await time.increase(20000);
            await expect(staking.connect(user1).deposit(100)).to.be.revertedWith('Not allowed to deposit');
        });

        it('Should fail if zero amount', async function () {
            const {
                staking,
                mock,
                accounts: [, user1],
            } = await loadFixture(deployStakingFixture);

            await time.increase(1000);
            await expect(staking.connect(user1).deposit(0)).to.be.revertedWith('Amount must be non-zero');
        });
    });

    describe('Withdrawals', function () {
        it('Should withdraw for one user', async function () {
            const {
                staking,
                mock,
                accounts: [, user1],
            } = await loadFixture(deployStakingFixture);

            await mock.transfer(staking.address, oneToken);
            await time.increase(1000);
            await staking.connect(user1).deposit(userDeposit);
            let stakeTime = await time.latest();

            await time.increase(99);
            await expect(staking.connect(user1).withdraw()).to.changeTokenBalances(
                mock,
                [staking.address, user1.address],
                [userDeposit.add(oneToken).mul(-1), userDeposit.add(oneToken)]
            );

            let userInfo = await staking.userInfo(user1.address);

            expect(userInfo.amount).to.be.eq(0);
            expect(userInfo.rewardDebt).to.be.eq(0);
            expect(userInfo.rewardDue).to.be.eq(0);
            expect(userInfo.stakedTime).to.be.eq(stakeTime);

            expect(await staking.lastRewardTime()).to.be.eq(await time.latest());
            expect(await staking.totalStake()).to.be.eq(0);
            expect(await staking.totalWithdrawReward()).to.be.eq(oneToken);

            // 100 (seconds) * 0.01 (rewardPerSec) * 10**12(addition precision) / 100 (totalTokenStaked) == 10**10
            let accTokenPerShare = 10n ** 10n;
            expect(await staking.accTokenPerShare()).to.be.eq(accTokenPerShare);
        });

        it('Should withdraw stake for two users', async function () {
            const {
                staking,
                mock,
                accounts: [, user1, user2],
            } = await loadFixture(deployStakingFixture);

            await mock.transfer(staking.address, oneToken.mul(3));
            await time.increase(1000);
            await staking.connect(user1).deposit(userDeposit);

            await time.increase(99);
            await staking.connect(user2).deposit(userDeposit);

            await time.increase(99);

            let firstAmount = userDeposit.add(oneToken.mul(3).div(2));
            let secondAmount = userDeposit.add(oneToken.div(2)).add(rewardPerSecond);
            await expect(staking.connect(user1).withdraw()).to.changeTokenBalances(
                mock,
                [staking.address, user1.address],
                [firstAmount.mul(-1), firstAmount]
            );
            await expect(staking.connect(user2).withdraw()).to.changeTokenBalances(
                mock,
                [staking.address, user2.address],
                [secondAmount.mul(-1), secondAmount]
            );
        });

        it('Should emit Withdraw event on withdraw', async function () {
            const {
                staking,
                mock,
                accounts: [, user1],
            } = await loadFixture(deployStakingFixture);

            await mock.transfer(staking.address, oneToken);
            await time.increase(1000);
            await staking.connect(user1).deposit(userDeposit);

            await time.increase(99);
            await expect(staking.connect(user1).withdraw())
                .to.emit(staking, 'Withdraw')
                .withArgs(user1.address, userDeposit);
        });

        it('Should emit WithdrawReward event on withdraw', async function () {
            const {
                staking,
                mock,
                accounts: [, user1],
            } = await loadFixture(deployStakingFixture);

            await mock.transfer(staking.address, oneToken);
            await time.increase(1000);
            await staking.connect(user1).deposit(userDeposit);

            await time.increase(99);
            await expect(staking.connect(user1).withdraw())
                .to.emit(staking, 'WithdrawReward')
                .withArgs(user1.address, oneToken);
        });

        it('Should fail if no active stake', async function () {
            const {
                staking,
                mock,
                accounts: [, user1],
            } = await loadFixture(deployStakingFixture);

            await time.increase(1000);
            await expect(staking.connect(user1).withdraw()).to.be.revertedWith('There are no active stake to withdraw');
        });

        it('Should fail if not enough reward', async function () {
            const {
                staking,
                mock,
                accounts: [, user1, user2],
            } = await loadFixture(deployStakingFixture);

            await time.increase(1000);
            await staking.connect(user1).deposit(userDeposit);

            await time.increase(99);
            await staking.connect(user2).deposit(userDeposit);

            await time.increase(99);
            await expect(staking.connect(user2).withdraw()).to.be.revertedWith('Not enough funds for reward');
        });
    });

    describe('Pending features', function () {
        it('Should calculate reward for one user', async function () {
            const {
                staking,
                mock,
                accounts: [, user1],
            } = await loadFixture(deployStakingFixture);

            await time.increase(1000);
            await staking.connect(user1).deposit(userDeposit);

            await time.increase(100);

            expect(await staking.pendingReward(user1.address)).to.be.eq(oneToken);
        });

        it('Should calculate reward for redeposit for one user', async function () {
            const {
                staking,
                mock,
                accounts: [, user1],
            } = await loadFixture(deployStakingFixture);

            await time.increase(1000);
            await staking.connect(user1).deposit(userDeposit);

            await time.increase(99);
            await staking.connect(user1).deposit(userDeposit);

            await time.increase(100);
            expect(await staking.pendingReward(user1.address)).to.be.eq(oneToken.mul(2));
        });

        it('Should calculate reward after withdraw for one user', async function () {
            const {
                staking,
                mock,
                accounts: [, user1],
            } = await loadFixture(deployStakingFixture);

            await mock.transfer(staking.address, oneToken);
            await time.increase(1000);
            await staking.connect(user1).deposit(userDeposit);

            await time.increase(99);
            await staking.connect(user1).withdraw();

            await time.increase(99);
            await staking.connect(user1).deposit(userDeposit);

            await time.increase(100);
            expect(await staking.pendingReward(user1.address)).to.be.eq(oneToken);
        });

        it('Should calculate reward for two users', async function () {
            const {
                staking,
                mock,
                accounts: [, user1, user2],
            } = await loadFixture(deployStakingFixture);

            await mock.transfer(staking.address, oneToken);
            await time.increase(1000);
            await staking.connect(user1).deposit(userDeposit);

            await time.increase(99);
            await staking.connect(user2).deposit(userDeposit);

            await time.increase(100);
            expect(await staking.pendingReward(user1.address)).to.be.eq(oneToken.mul(3).div(2));
            expect(await staking.pendingReward(user2.address)).to.be.eq(oneToken.div(2));
        });
    });
});

function getTimestampInSeconds() {
    return Math.floor(Date.now() / 1000);
}
