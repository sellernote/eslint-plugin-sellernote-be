import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/types';
import { ESLintUtils } from '@typescript-eslint/utils';

type MessageIds = 'issue:not-specify';

type Options = [];

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/sellernote/eslint-plugin-sellernote-be/blob/main/docs/rules/${name}.md`
);

export const typeormColumnShouldSpecifyType = createRule<Options, MessageIds>({
  name: 'typeorm-column-should-specify-type',
  meta: {
    docs: {
      description: 'TypeORM `Column` annotation should specify a `type` property',
    },
    type: 'suggestion',
    schema: [],
    messages: {
      'issue:not-specify': 'Should specify a `type` property for @Column',
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
          // TODO TypeORM 은 ObjectLiteral에 `type`을 명시해도 되지만, 첫 번째 매개변수에 `type`이 올 수 있음
          if (arg.type === AST_NODE_TYPES.ObjectExpression) {
            return !!arg.properties.find(
              (prop) =>
                prop.type === AST_NODE_TYPES.Property &&
                prop.key.type === AST_NODE_TYPES.Identifier &&
                prop.key.name === 'type'
            );
          }
          return false;
        });

        if (!target) {
          context.report({ node, messageId: 'issue:not-specify' });
        }
      },
    };
  },
});
