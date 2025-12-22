import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/types';
import { ESLintUtils } from '@typescript-eslint/utils';
import { TypeFlags } from 'typescript';

type MessageIds = 'issue:do-not-have';

type Options = [];

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/sellernote/eslint-plugin-sellernote-be/blob/main/docs/rules/${name}.md`
);

export const typeormNullableColumnShouldHaveNullUnionType = createRule<Options, MessageIds>({
  name: 'typeorm-nullable-column-should-have-null-union-type',
  meta: {
    docs: {
      description: 'TypeORM nullable column should have `null` union type',
    },
    type: 'suggestion',
    schema: [],
    messages: {
      'issue:do-not-have': 'Should have `null` union type',
    },
  },
  defaultOptions: [],
  create: (context) => {
    return {
      PropertyDefinition: (node: TSESTree.PropertyDefinition) => {
        const columnDecorator = node.decorators.find(
          (d) => ((d.expression as TSESTree.CallExpression).callee as TSESTree.Identifier)?.name === 'Column'
        );
        if (!columnDecorator) {
          return;
        }

        const target = (columnDecorator.expression as TSESTree.CallExpression).arguments.find((arg) => {
          if (arg.type === AST_NODE_TYPES.ObjectExpression) {
            return !!arg.properties.find(
              (prop) =>
                prop.type === AST_NODE_TYPES.Property &&
                prop.key.type === AST_NODE_TYPES.Identifier &&
                prop.key.name === 'nullable' &&
                prop.value.type === AST_NODE_TYPES.Literal &&
                prop.value.value === true
            );
          }
          return false;
        });

        if (target) {
          if (
            node.typeAnnotation?.typeAnnotation.type === AST_NODE_TYPES.TSUnionType &&
            node.typeAnnotation?.typeAnnotation.types.find((t) => t.type === AST_NODE_TYPES.TSNullKeyword)
          ) {
            return;
          } else if (node.typeAnnotation?.typeAnnotation.type === AST_NODE_TYPES.TSTypeReference) {
            const parserServices = ESLintUtils.getParserServices(context);
            const checker = parserServices.program.getTypeChecker();
            const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
            const type = checker.getTypeAtLocation(tsNode);
            if (type.isUnion()) {
              if (type.types.find((t) => t.flags === TypeFlags.Null)) {
                // ok
              } else {
                context.report({ node, messageId: 'issue:do-not-have' });
              }
            } else {
              context.report({ node, messageId: 'issue:do-not-have' });
            }
          } else {
            context.report({ node, messageId: 'issue:do-not-have' });
          }
        }
      },
    };
  },
});
