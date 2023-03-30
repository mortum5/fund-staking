// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require('hardhat');
require('dotenv').config();

const { TOKEN, REWARD_PER_SECOND, START_TIME, END_TIME } = process.env;

async function main() {
    
    let rewardPerSecond = ethers.utils.parseUnits(REWARD_PER_SECOND, 4)

    const Staking = await hre.ethers.getContractFactory('Staking');
    const staking = await Staking.deploy(TOKEN, REWARD_PER_SECOND, START_TIME, END_TIME);

    await staking.deployed();
    console.log('Staking deployed at: ', staking.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
