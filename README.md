# Fund staking smart contract

## Table of contents
- [Fund staking smart contract](#fund-staking-smart-contract)
  - [Table of contents](#table-of-contents)
  - [General info](#general-info)
  - [Technologies](#technologies)
  - [Setup](#setup)

## General info
Staking smart contract with per second reward distribution.
	
## Technologies
Project is created with:
* Yarn version: 1.22.19
* Hardhat version: 2.13.0
* Solidity version: 0.8.19
	
## Setup
To run this project, install it locally using yarn:

```shell
$ yarn                  # install project dependencies
$ cp env.example .env   # copy environment

$ npx hardhat test      # test project
$ npx hardhat run scripts/deploy.js --network $networkName # project deploy
```
