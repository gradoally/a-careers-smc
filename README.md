# A Careers Smart-contracts

Decentralized freelance-exchange with user profiles on blockchain TON.

## Project Structure

-   `contracts` - Source code of all the smart contracts of the project and their dependencies.
-   `wrappers` - Wrapper classes (implementing `Contract` from ton-core) for the contracts, including any [de]serialization primitives and compilation functions.
-   `tests` - Tests for the contracts.
-   `scripts` - Scripts used by the project, mainly the deployment scripts.

## Getting Started

### Prerequisites
- Node.js
- Yarn or npm

### Installation

1. Clone the repository:
    ```sh
    git clone https://github.com/gradoally/a-careers-smc.git
    cd a-careers-smc
    ```

2. Install dependencies:
    ```sh
    yarn install
    # or
    npm install
    ```

### Usage

#### Build

```sh
npx blueprint build
# or
yarn blueprint build
```

#### Test

```sh
npx blueprint test
# or
yarn blueprint test
```

#### Deploy or Run Another Script

```sh
npx blueprint run
# or
yarn blueprint run
```

#### Add a New Contract

```sh
npx blueprint create ContractName
# or
yarn blueprint create ContractName
```

## Contributing

We welcome contributions! Please see the [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.