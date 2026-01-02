# DEPLICATED: eslint-plugin-sellernote-be

[sellernote-backend-eslint-plugin](https://github.com/sellernote/sellernote-backend-eslint-plugin)로 이관되었습니다. 이 repository는 곧 제거 예정입니다.

Custom ESLint rules for Sellernote.

## Why?

Just developing for my team.

## Installation

You'll first need to install [ESLint](http://eslint.org):

```
$ npm i -D eslint
```

Next, install `eslint-plugin-sellernote-be`:

```
$ npm install -D https://github.com/sellernote/eslint-plugin-sellernote-be
```

## Usage

Add `sellernote` to the plugins section of your configuration file. Note that below configuration examples are for flat-configuration format.

```js
import sellernote from 'eslint-plugin-sellernote-be';

export default [
  {
    plugins: {
      // ...
      sellernote,
    },
  },
];
```

Then configure the rules you want to use under the `Supported Rules` section.

```js
export default [
  // ....
  {
    rules: {
      // .....
      'sellernote/rule-name-to-add': 'warn',
    },
  },
];
```

## Supported Rules

<!-- begin auto-generated rules list -->

| Name                                                                                                                     | Description                                                                                                                                             |
| :----------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [array-index-check-undefined](docs/rules/array-index-check-undefined.md)                                                 | Enforce undefined check when accessing array elements by index to prevent runtime errors                                                                |
| [repository-method-prefix](docs/rules/repository-method-prefix.md)                                                       | The method name in repository should start with `findOne`, `findMany` for read, `create` for creation, `update` for modification, `delete` for deletion |
| [typeorm-column-should-specify-type](docs/rules/typeorm-column-should-specify-type.md)                                   | TypeORM `Column` annotation should specify a `type` property                                                                                            |
| [typeorm-nullable-column-should-have-null-union-type](docs/rules/typeorm-nullable-column-should-have-null-union-type.md) | TypeORM nullable column should have `null` union type                                                                                                   |
| [use-api-operation](docs/rules/use-api-operation.md)                                                                     | Use `@ApiOperation` for API endpoints                                                                                                                   |

<!-- end auto-generated rules list -->

## Special Thanks to

https://ts-ast-viewer.com/
