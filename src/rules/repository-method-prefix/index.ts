import path from 'path';

import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/types';
import { ESLintUtils } from '@typescript-eslint/utils';

type MessageIds = 'issue:violate';

type Options = [
  {
    targetFilePattern: string;
    allowPrefixes: string[];
  },
];

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/sellernote/eslint-plugin-sellernote-be/blob/main/docs/rules/${name}.md`
);

export const repositoryMethodPrefix = createRule<Options, MessageIds>({
  name: 'repository-method-prefix',
  meta: {
    docs: {
      description:
        'The method name in repository should start with `findOne`, `findMany` for read, `create` for creation, `update` for modification, `delete` for deletion',
    },
    type: 'suggestion',
    schema: [
      {
        type: 'object',
        properties: {
          targetFilePattern: {
            description: 'The regex for target files',
            type: 'string',
            default: '\\.repository\\.ts$',
          },
          allowPrefixes: {
            description: 'Allowed prefixes for method name',
            type: 'array',
            default: ['findOne', 'findMany', 'update', 'delete', 'create'],
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      'issue:violate':
        'The method name in repository should start with `findOne`, `findMany`, `create`, `update`, `delete`',
    },
  },
  defaultOptions: [
    {
      targetFilePattern: '\\.repository\\.ts$',
      allowPrefixes: ['findOne', 'findMany', 'update', 'delete', 'create'],
    },
  ],
  create: (context, options) => {
    return {
      MethodDefinition: (node: TSESTree.MethodDefinition) => {
        const regexFileNames = new RegExp(options[0].targetFilePattern);
        if (!regexFileNames.test(path.basename(context.filename))) {
          return;
        }
        if (node.key.type === AST_NODE_TYPES.Identifier) {
          // `constructor`, `get', `set`은 검사 대상에서 제외
          if (node.kind !== 'method') {
            return;
          }

          // 정규식 생성 (대소문자 구분)
          const regexPrefixes = new RegExp(`^(${options[0].allowPrefixes.join('|')})`);

          if (!regexPrefixes.test(node.key.name)) {
            context.report({ node, messageId: 'issue:violate' });
          }
        }
      },
    };
  },
});
