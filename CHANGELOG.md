# Changelog

## [1.4.0](https://github.com/merceyz/eslint-plugin-sqlite/compare/v1.3.0...v1.4.0) (2024-09-29)


### Features

* support any string value in map and join ([15890ee](https://github.com/merceyz/eslint-plugin-sqlite/commit/15890ee19f49285ccfa51874dfd98269f002287e))

## [1.3.0](https://github.com/merceyz/eslint-plugin-sqlite/compare/v1.2.0...v1.3.0) (2024-09-22)


### Features

* infer types from opcodes ([35656df](https://github.com/merceyz/eslint-plugin-sqlite/commit/35656df595dafc8bf5b00c7c44b19a15798c9246))


### Bug Fixes

* handle columns not in `pragma_table_info` ([dde4b89](https://github.com/merceyz/eslint-plugin-sqlite/commit/dde4b896d909fc4b01d781e9439fcbdaaead3433))

## [1.2.0](https://github.com/merceyz/eslint-plugin-sqlite/compare/v1.1.0...v1.2.0) (2024-09-08)


### Features

* support LIKE operator ([53e36fa](https://github.com/merceyz/eslint-plugin-sqlite/commit/53e36fa4ea170c14bf9eb53e883b672123c6c30f))


### Bug Fixes

* check if not null column is always present ([747cc6a](https://github.com/merceyz/eslint-plugin-sqlite/commit/747cc6a433b1513d098fa982384d54b8aa7a33dc))
* handle column aliasing the rowid ([24436c9](https://github.com/merceyz/eslint-plugin-sqlite/commit/24436c9a4f911059943e28c05c99710c8874727a))
* handle varied casing and quoted identifiers ([202faf3](https://github.com/merceyz/eslint-plugin-sqlite/commit/202faf329d20fb7a4f90da53643d64025b5fc5e2))

## [1.1.0](https://github.com/merceyz/eslint-plugin-sqlite/compare/v1.0.0...v1.1.0) (2024-09-03)


### Features

* check if column is nullable ([1b7266a](https://github.com/merceyz/eslint-plugin-sqlite/commit/1b7266adfeea78de07a6b0efc35e4d9fd94f6537))
* support variable input parameters ([adfaab4](https://github.com/merceyz/eslint-plugin-sqlite/commit/adfaab4b02714d97eb2a897c67e861cf310155bc))

## 1.0.0 (2024-08-31)


### Features

* add typed-input rule ([e72f56a](https://github.com/merceyz/eslint-plugin-sqlite/commit/e72f56a62d8be433003ff67019348763e4bc5826))
* add typed-result rule ([f390944](https://github.com/merceyz/eslint-plugin-sqlite/commit/f39094434ac6cf891fc2c7da84bd7c47ebe9db29))
* add valid-query rule ([ed290fe](https://github.com/merceyz/eslint-plugin-sqlite/commit/ed290fea7c868f3492dcf4e4409b98ab223843ef))
* inferQueryInput ([623affc](https://github.com/merceyz/eslint-plugin-sqlite/commit/623affc498079782036b06407f276c36a0771929))
* inferQueryResult ([b47c5cc](https://github.com/merceyz/eslint-plugin-sqlite/commit/b47c5cca521bfb256be55b7086f012a0fdc79d93))
* report on non-static and non-string static values ([2fb96a4](https://github.com/merceyz/eslint-plugin-sqlite/commit/2fb96a48b01b0d9e9be93ddb34a9e7a528e7e62a))
* support overriding unknown type ([f1d4a89](https://github.com/merceyz/eslint-plugin-sqlite/commit/f1d4a89f72d6dc8521154e2d3b368a383154cf8d))


### Bug Fixes

* handle ANY as a combination of the other types ([ac55881](https://github.com/merceyz/eslint-plugin-sqlite/commit/ac55881176174535842df6d0f33e049dba97cf76))
* **infer:** handle queries that don't return data ([78c096e](https://github.com/merceyz/eslint-plugin-sqlite/commit/78c096ec2c9f472070a2af30a3c94d9eeda1ed7f))
* **infer:** ignore invalid queries ([a1ef786](https://github.com/merceyz/eslint-plugin-sqlite/commit/a1ef786c378cdd4f51861811226e9c41fad0cbd4))
