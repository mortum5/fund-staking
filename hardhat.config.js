require('@nomicfoundation/hardhat-toolbox');
require('@nomicfoundation/hardhat-chai-matchers');
require('dotenv').config();

const { ETHERSCAN_API, INFURA_ID_PROJECT, MNEMONIC } = process.env;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        compilers: [
            {
                version: '0.8.19',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
            {
                version: '0.8.9',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
        ],
    },
    defaultNetwork: 'hardhat',
    networks: {
        hardhat: {
            accounts: {
                count: 10,
            },
        },
        goerli: {
            chainId: 5,
            url: 'https://goerli.infura.io/v3/' + INFURA_ID_PROJECT,
            accounts: {
                mnemonic: MNEMONIC,
            },
            saveDeployments: true,
        },
    },
    etherscan: {
        apiKey: {
            goerli: ETHERSCAN_API,
        },
    },
};
