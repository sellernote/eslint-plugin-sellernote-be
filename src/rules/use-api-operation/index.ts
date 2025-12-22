import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/types';
import { ESLintUtils } from '@typescript-eslint/utils';

type MessageIds = 'issue:not-exist' | 'issue:summary-not-exist' | 'issue:desc-not-exist';

type Options = [
  {
    shouldBeSummary: boolean;
    shouldBeDescription: boolean;
  },
];

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/sellernote/eslint-plugin-sellernote-be/blob/main/docs/rules/${name}.md`
);

export const useApiOperation = createRule<Options, MessageIds>({
  name: 'use-api-operation',
  meta: {
    docs: {
      description: 'Use \`@ApiOperation`\ for API endpoints',
    },
    type: 'suggestion',
    schema: [
      {
        type: 'object',
        properties: {
          shouldBeSummary: {
            description: 'The annotation should have \`summary\` property',
            type: 'boolean',
            default: true,
          },
          shouldBeDescription: {
            description: 'The annotation should have \`description\` property',
            type: 'boolean',
            default: true,
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      'issue:not-exist': 'Use @ApiOperation for API Endpoints',
      'issue:summary-not-exist': `Should be 'summary' property for @ApiOperation`,
      'issue:desc-not-exist': `Should be 'description' property for @ApiOperation`,
    },
  },
  defaultOptions: [{ shouldBeSummary: true, shouldBeDescription: true }],
  create: (context, options) => {
    return {
      MethodDefinition: (node: TSESTree.MethodDefinition) => {
        const targetDecorators = ['Get', 'Post', 'Delete', 'Patch', 'Put'];
        const isInTarget = node.decorators?.some((d: TSESTree.Decorator) => {
          return (
            d.expression.type === AST_NODE_TYPES.CallExpression &&
            d.expression.callee.type === AST_NODE_TYPES.Identifier &&
            targetDecorators.includes(d.expression.callee.name)
          );
        });
        if (!isInTarget) {
          return;
        }
        const isExistApiOperationDecorators = node.decorators?.find((d: TSESTree.Decorator) => {
          return (
            d.expression.type === AST_NODE_TYPES.CallExpression &&
            d.expression.callee.type === AST_NODE_TYPES.Identifier &&
            d.expression.callee.name === 'ApiOperation'
          );
        });

        if (!isExistApiOperationDecorators) {
          context.report({ node, messageId: 'issue:not-exist' });
        } else {
          const args = (isExistApiOperationDecorators.expression as TSESTree.CallExpression).arguments;
          args.forEach((v) => {
            if (v.type === AST_NODE_TYPES.ObjectExpression) {
              const summary = v.properties.find((property: TSESTree.ObjectLiteralElementLike) => {
                if (property.type !== AST_NODE_TYPES.Property) {
                  return false;
                }
                return (property.key as TSESTree.Identifier).name === 'summary';
              });

              if (!summary && options[0].shouldBeSummary) {
                context.report({ node, messageId: 'issue:summary-not-exist' });
              }

              const desc = v.properties.find((property: TSESTree.ObjectLiteralElementLike) => {
                if (property.type !== AST_NODE_TYPES.Property) {
                  return false;
                }
                return (property.key as TSESTree.Identifier).name === 'description';
              });
              if (!desc && options[0].shouldBeDescription) {
                context.report({ node, messageId: 'issue:desc-not-exist' });
              }
            }
          });
        }
      },
    };
  },
});
