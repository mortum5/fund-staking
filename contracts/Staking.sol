// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract Staking is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // The precision factor
    uint256 public constant PRECISION_FACTOR = 10 ** 12;
       
    // The staked and reward token
    IERC20 public token;

    // Accrued token per share
    uint256 public accTokenPerShare;

    // Time when deposits has started
    uint256 public startTime;

    // Time when new deposits has stopped
    uint256 public endTime;

    // Time of the last pool update
    uint256 public lastRewardTime;

    // Tokens reward per second.
    uint256 public rewardPerSecond;

    // Total staked tokens
    uint256 public totalStake;

    // Total withdrawn reward
    uint256 public totalWithdrawReward;

    // Info of each user that stakes tokens (token)
    mapping(address => UserInfo) public userInfo;

    struct UserInfo {
        uint256 amount; // How many staked tokens the user has provided
        uint256 rewardDebt; // Reward debt
        uint256 rewardDue; // How much user must receive
        uint256 stakedTime; // Staked time
    }

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event WithdrawReward(address indexed user, uint256 amount);

    /**
     * @notice Create contract
     * @param _token: staked token address
     * @param _rewardPerSecond: reward per seconds (in token)
     * @param _startTime: start stake time
     * @param _endTime: end time of staking
     */
    constructor(IERC20 _token, uint256 _rewardPerSecond, uint256 _startTime, uint256 _endTime) {
        token = _token;
        rewardPerSecond = _rewardPerSecond;
        startTime = _startTime;
        endTime = _endTime;

        // Set the lastRewardTime as the startTime
        lastRewardTime = _startTime;
    }

    /**
     * @notice Deposit staked tokens
     * @param _amount: amount to deposit (in token)
     */
    function deposit(uint256 _amount) external nonReentrant {
        require(block.timestamp >= startTime && block.timestamp <= endTime, 'Not allowed to deposit');
        require(_amount > 0, 'Amount must be non-zero');
        UserInfo memory user = userInfo[msg.sender];

        _updatePool();

        if (user.amount > 0) {
            uint256 pending = (user.amount * accTokenPerShare) / PRECISION_FACTOR - user.rewardDebt;
            if (pending > 0) {
                user.rewardDue += pending;
            }
        }

        if (user.stakedTime == 0) {
            user.stakedTime = block.timestamp;
        }

        user.amount = user.amount + _amount;
        user.rewardDebt = (user.amount * accTokenPerShare) / PRECISION_FACTOR;
        userInfo[msg.sender] = user;

        totalStake += _amount;

        token.safeTransferFrom(address(msg.sender), address(this), _amount);
        emit Deposit(msg.sender, _amount);
    }

    /**
     * @notice Withdraw staked tokens and collect reward tokens
     */
    function withdraw() external nonReentrant {
        UserInfo memory user = userInfo[msg.sender];
        require(user.amount > 0, 'There are no active stake to withdraw');

        _updatePool();

        uint256 pending = (user.amount * accTokenPerShare) / PRECISION_FACTOR - user.rewardDebt;

        require(user.rewardDue + pending <= token.balanceOf(address(this)) - totalStake, 'Not enough funds for reward');

        totalStake -= user.amount;
        totalWithdrawReward += (pending + user.rewardDue);

        uint256 amount = user.amount + pending + user.rewardDue;

        emit Withdraw(msg.sender, user.amount);
        emit WithdrawReward(msg.sender, pending + user.rewardDue);

        user.amount = 0;
        user.rewardDebt = 0;
        user.rewardDue = 0;

        userInfo[msg.sender] = user;
        token.safeTransfer(address(msg.sender), amount);
    }

    /**
     * @notice View function to see pending reward on frontend.
     * @param _user: user address
     * @return Pending reward for a given user
     */
    function pendingReward(address _user) external view returns (uint256) {
        UserInfo storage user = userInfo[_user];
        if (block.timestamp > lastRewardTime && totalStake != 0) {
            uint256 multiplier = _getMultiplier(lastRewardTime, block.timestamp);
            uint256 reward = multiplier * rewardPerSecond;
            uint256 adjustedTokenPerShare = accTokenPerShare + (reward * PRECISION_FACTOR) / totalStake;
            return (user.amount * adjustedTokenPerShare) / PRECISION_FACTOR - user.rewardDebt + user.rewardDue;
        } else {
            return (user.amount * accTokenPerShare) / PRECISION_FACTOR - user.rewardDebt + user.rewardDue;
        }
    }

    /**
     * @notice Update reward variables of the given pool to be up-to-date.
     */
    function _updatePool() internal {
        if (block.timestamp <= lastRewardTime) {
            return;
        }

        if (totalStake == 0) {
            lastRewardTime = block.timestamp;
            return;
        }

        uint256 multiplier = _getMultiplier(lastRewardTime, block.timestamp);
        uint256 reward = multiplier * rewardPerSecond;
        accTokenPerShare = accTokenPerShare + (reward * PRECISION_FACTOR) / totalStake;
        lastRewardTime = block.timestamp;
    }

    /**
     * @notice Return reward multiplier over the given _from to _to block.
     * @param _from: block to start
     * @param _to: block to finish
     */
    function _getMultiplier(uint256 _from, uint256 _to) internal view returns (uint256) {
        if (_from < startTime) {
            return 0;
        } else {
            return _to - _from;
        }
    }
}
