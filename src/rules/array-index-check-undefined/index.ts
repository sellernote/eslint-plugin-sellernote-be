import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/types';
import { ESLintUtils, ParserServicesWithTypeInformation } from '@typescript-eslint/utils';
import * as ts from 'typescript';

type MessageIds = 'issue:unsafe-access' | 'issue:unsafe-usage';

type Options = [];

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/sellernote/eslint-plugin-sellernote-be/blob/main/docs/rules/${name}.md`
);

/**
 * TypeScript 타입 정보를 사용하여 안전한 접근인지 확인
 * - keyof 타입으로 제한된 키로 접근하는 경우
 * - enum 키로 접근하는 경우
 * - 리터럴 타입의 union으로 제한된 경우
 */
function isSafeKeyAccess(node: TSESTree.MemberExpression, services: ParserServicesWithTypeInformation | null): boolean {
  if (!services) {
    return false;
  }

  // computed 접근만 확인 (obj[key])
  if (!node.computed) {
    return false;
  }

  // property가 식별자여야 함 (변수)
  if (node.property.type !== AST_NODE_TYPES.Identifier) {
    return false;
  }

  try {
    const checker = services.program.getTypeChecker();
    const tsNode = services.esTreeNodeToTSNodeMap.get(node);

    if (!tsNode || !ts.isElementAccessExpression(tsNode)) {
      return false;
    }

    const objectType = checker.getTypeAtLocation(tsNode.expression);
    const indexType = checker.getTypeAtLocation(tsNode.argumentExpression);

    return isTypeSafeIndex(indexType, objectType, checker);
  } catch {
    return false;
  }
}

/**
 * enum 타입인지 확인
 */
function isEnumType(type: ts.Type): boolean {
  // EnumLiteral 플래그 확인 (enum 멤버)
  if (type.flags & ts.TypeFlags.EnumLiteral) {
    return true;
  }

  // union of enum literals (enum 전체 타입)
  if (type.isUnion()) {
    return type.types.every((t) => t.flags & ts.TypeFlags.EnumLiteral);
  }

  // symbol이 enum 멤버인지 확인
  const symbol = type.getSymbol();
  if (symbol) {
    const declarations = symbol.getDeclarations();
    if (declarations?.some((d) => ts.isEnumMember(d) || ts.isEnumDeclaration(d.parent))) {
      return true;
    }
  }

  return false;
}

/**
 * 인덱스 타입이 객체의 키 타입으로 안전한지 확인
 */
function isTypeSafeIndex(indexType: ts.Type, objectType: ts.Type, checker: ts.TypeChecker): boolean {
  // 숫자 타입이면 배열 인덱스이므로 unsafe
  if (indexType.flags & ts.TypeFlags.Number) {
    return false;
  }

  // 숫자 리터럴이면 배열 인덱스이므로 unsafe
  if (indexType.isNumberLiteral()) {
    return false;
  }

  // 객체가 배열 타입이면 unsafe
  if (checker.isArrayType(objectType) || checker.isTupleType(objectType)) {
    return false;
  }

  // enum 타입인 경우 - Record<EnumType, ValueType>에서 enum 키로 접근하면 항상 안전
  // (enum의 모든 값에 대해 Record가 값을 가지므로)
  if (isEnumType(indexType)) {
    return true;
  }

  // 인덱스 타입이 리터럴 타입의 union인 경우 (keyof 같은 경우)
  if (indexType.isUnion()) {
    const allLiterals = indexType.types.every((t) => t.isStringLiteral() || t.isNumberLiteral() || isEnumType(t));
    if (allLiterals) {
      return true;
    }
  }

  // 인덱스 타입이 string literal인 경우
  if (indexType.isStringLiteral()) {
    return true;
  }

  // 인덱스 타입이 특정 키들로 제한된 경우 확인
  // 예: T extends keyof typeof FORM
  const indexBaseConstraint = checker.getBaseConstraintOfType(indexType);
  if (indexBaseConstraint && indexBaseConstraint !== indexType) {
    return isTypeSafeIndex(indexBaseConstraint, objectType, checker);
  }

  // 객체의 속성들 확인
  const properties = checker.getPropertiesOfType(objectType);

  // 속성이 없으면 unsafe (빈 객체 또는 Record<string, T> 같은 경우)
  // 단, 위에서 enum/keyof/literal 체크를 이미 했으므로 여기까지 오면 unsafe
  if (properties.length === 0) {
    return false;
  }

  return false;
}

/**
 * 배열 인덱스 접근인지 확인
 */
function isArrayIndexAccess(node: TSESTree.MemberExpression): boolean {
  if (!node.computed) {
    return false;
  }

  const { type } = node.property;
  const isNumericLiteral =
    type === AST_NODE_TYPES.Literal && typeof (node.property as TSESTree.Literal).value === 'number';
  const isIdentifier = type === AST_NODE_TYPES.Identifier;
  const isBinaryExpression = type === AST_NODE_TYPES.BinaryExpression;

  return isNumericLiteral || isIdentifier || isBinaryExpression;
}

/**
 * MemberExpression의 객체 부분을 문자열로 변환
 */
function getObjectKey(node: TSESTree.Expression): string | null {
  if (node.type === AST_NODE_TYPES.Identifier) {
    return node.name;
  }
  if (node.type === AST_NODE_TYPES.MemberExpression && !node.computed) {
    const objKey = getObjectKey(node.object);
    if (objKey && node.property.type === AST_NODE_TYPES.Identifier) {
      return `${objKey}.${node.property.name}`;
    }
  }
  return null;
}

/**
 * for 문 조건에서 배열.length 체크가 있는지 확인
 * 예: i < array.length, i <= array.length - 1
 */
function getForLoopArrayInfo(forStatement: TSESTree.ForStatement): { indexVar: string; arrayKey: string } | null {
  const { test } = forStatement;
  if (!test || test.type !== AST_NODE_TYPES.BinaryExpression) {
    return null;
  }

  const { left, operator, right } = test;

  // i < array.length 또는 i <= array.length - 1
  if (operator !== '<' && operator !== '<=') {
    return null;
  }

  // 왼쪽이 인덱스 변수여야 함
  if (left.type !== AST_NODE_TYPES.Identifier) {
    return null;
  }
  const indexVar = left.name;

  // 오른쪽이 array.length 형태인지 확인
  let lengthExpr: TSESTree.MemberExpression | null = null;

  if (right.type === AST_NODE_TYPES.MemberExpression) {
    // i < array.length
    lengthExpr = right;
  } else if (
    right.type === AST_NODE_TYPES.BinaryExpression &&
    right.operator === '-' &&
    right.left.type === AST_NODE_TYPES.MemberExpression
  ) {
    // i <= array.length - 1
    lengthExpr = right.left;
  }

  if (!lengthExpr) {
    return null;
  }

  // .length 프로퍼티 접근인지 확인
  if (lengthExpr.property.type !== AST_NODE_TYPES.Identifier || lengthExpr.property.name !== 'length') {
    return null;
  }

  const arrayKey = getObjectKey(lengthExpr.object);
  if (!arrayKey) {
    return null;
  }

  return { indexVar, arrayKey };
}

/**
 * 노드가 for 문 내부에 있고, 해당 for 문의 조건으로 인해 안전한 접근인지 확인
 */
function isInsideSafeForLoop(node: TSESTree.MemberExpression): boolean {
  // 인덱스가 식별자가 아니면 체크하지 않음
  if (node.property.type !== AST_NODE_TYPES.Identifier) {
    return false;
  }
  const indexVar = node.property.name;
  const arrayKey = getObjectKey(node.object);
  if (!arrayKey) {
    return false;
  }

  // 상위 for 문 찾기
  let current: TSESTree.Node | undefined = node.parent;
  while (current) {
    if (current.type === AST_NODE_TYPES.ForStatement) {
      const forInfo = getForLoopArrayInfo(current);
      if (forInfo && forInfo.indexVar === indexVar && forInfo.arrayKey === arrayKey) {
        return true;
      }
    }
    current = current.parent;
  }

  return false;
}

/**
 * MemberExpression을 문자열 키로 변환 (예: "payload.bindList[0]")
 */
function getArrayIndexAccessKey(node: TSESTree.MemberExpression): string | null {
  if (!isArrayIndexAccess(node)) {
    return null;
  }

  // 객체 부분을 문자열로 변환
  let objectKey = '';
  if (node.object.type === AST_NODE_TYPES.Identifier) {
    objectKey = node.object.name;
  } else if (node.object.type === AST_NODE_TYPES.MemberExpression) {
    // 중첩된 경우 재귀적으로 처리
    const nestedKey = getMemberExpressionKey(node.object);
    if (nestedKey) {
      objectKey = nestedKey;
    } else {
      return null;
    }
  } else {
    return null;
  }

  // 인덱스 부분을 문자열로 변환
  let indexKey = '';
  if (node.property.type === AST_NODE_TYPES.Literal) {
    indexKey = String(node.property.value);
  } else if (node.property.type === AST_NODE_TYPES.Identifier) {
    indexKey = node.property.name;
  } else {
    // 복잡한 표현식은 추적하지 않음
    return null;
  }

  return `${objectKey}[${indexKey}]`;
}

/**
 * MemberExpression을 문자열 키로 변환 (점 표기법 포함)
 */
function getMemberExpressionKey(node: TSESTree.MemberExpression): string | null {
  if (node.computed) {
    // arr[0] 형태
    return getArrayIndexAccessKey(node);
  }

  // obj.prop 형태
  let objectKey = '';
  if (node.object.type === AST_NODE_TYPES.Identifier) {
    objectKey = node.object.name;
  } else if (node.object.type === AST_NODE_TYPES.MemberExpression) {
    const nestedKey = getMemberExpressionKey(node.object);
    if (nestedKey) {
      objectKey = nestedKey;
    } else {
      return null;
    }
  } else {
    return null;
  }

  if (node.property.type === AST_NODE_TYPES.Identifier) {
    return `${objectKey}.${node.property.name}`;
  }

  return null;
}

/**
 * parent가 child의 조상 노드인지 확인
 */
function isDescendant(parent: TSESTree.Node, child: TSESTree.Node): boolean {
  let current: TSESTree.Node | undefined = child.parent;
  while (current) {
    if (current === parent) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

/**
 * 논리 AND 연산자에서 안전한지 확인
 */
function isSafeInLogicalAnd(node: TSESTree.Node, expr: TSESTree.LogicalExpression): boolean {
  const isOnRightSide = expr.right === node || isDescendant(expr.right, node);
  return expr.operator === '&&' && isOnRightSide;
}

/**
 * 논리 Nullish 연산자인지 확인
 */
function isNullishCoalescing(expr: TSESTree.LogicalExpression): boolean {
  return expr.operator === '??';
}

/**
 * 조건부 표현식에서 안전한지 확인 (test 또는 consequent 부분)
 */
function isSafeInConditional(node: TSESTree.Node, expr: TSESTree.ConditionalExpression): boolean {
  const isInTest = expr.test === node || isDescendant(expr.test, node);
  const isInConsequent = expr.consequent === node || isDescendant(expr.consequent, node);
  return isInTest || isInConsequent;
}

/**
 * 현재 노드가 null 체크 컨텍스트에서 안전한지 확인
 */
function checkNodeSafety(node: TSESTree.Node, current: TSESTree.Node): boolean {
  if (current.type === AST_NODE_TYPES.IfStatement) {
    return true;
  }

  if (current.type === AST_NODE_TYPES.LogicalExpression) {
    return isSafeInLogicalAnd(node, current) || isNullishCoalescing(current);
  }

  if (current.type === AST_NODE_TYPES.ConditionalExpression) {
    return isSafeInConditional(node, current);
  }

  return false;
}

/**
 * 부모 노드가 undefined/null 체크를 하는 조건문인지 확인
 */
function isInsideNullCheck(node: TSESTree.Node): boolean {
  let current: TSESTree.Node | undefined = node.parent;

  while (current) {
    if (checkNodeSafety(node, current)) {
      return true;
    }
    current = current.parent;
  }

  return false;
}

/**
 * Optional chaining이 사용되었는지 확인
 */
function hasOptionalChaining(node: TSESTree.MemberExpression): boolean {
  if (node.optional) {
    return true;
  }

  let current: TSESTree.Node | undefined = node.parent;
  while (current) {
    if (current.type === AST_NODE_TYPES.ChainExpression) {
      return true;
    }
    current = current.parent;
  }

  return false;
}

/**
 * 이진 표현식이 null/undefined 체크인지 확인 (변수명)
 */
function isBinaryNullCheck(expr: TSESTree.BinaryExpression, variableName: string): boolean {
  const { left, operator, right } = expr;

  // !==, !=, ===, == 모두 지원
  if (operator !== '!==' && operator !== '!=' && operator !== '===' && operator !== '==') {
    return false;
  }

  if (left.type !== AST_NODE_TYPES.Identifier || left.name !== variableName) {
    return false;
  }

  const isNullLiteral = right.type === AST_NODE_TYPES.Literal && (right.value === null || right.value === undefined);
  const isUndefinedIdentifier = right.type === AST_NODE_TYPES.Identifier && right.name === 'undefined';

  return isNullLiteral || isUndefinedIdentifier;
}

/**
 * 이진 표현식이 null/undefined 체크인지 확인 (표현식 키)
 */
function isBinaryNullCheckForExpression(expr: TSESTree.BinaryExpression, expressionKey: string): boolean {
  const { left, operator, right } = expr;

  // !==, !=, ===, == 모두 지원
  if (operator !== '!==' && operator !== '!=' && operator !== '===' && operator !== '==') {
    return false;
  }

  // 왼쪽이 배열 인덱스 접근인지 확인
  if (left.type !== AST_NODE_TYPES.MemberExpression) {
    return false;
  }

  const leftKey = getArrayIndexAccessKey(left);
  if (leftKey !== expressionKey) {
    return false;
  }

  const isNullLiteral = right.type === AST_NODE_TYPES.Literal && (right.value === null || right.value === undefined);
  const isUndefinedIdentifier = right.type === AST_NODE_TYPES.Identifier && right.name === 'undefined';

  return isNullLiteral || isUndefinedIdentifier;
}

/**
 * 식별자(변수)가 null/undefined 체크되는지 확인하는 조건식인지
 */
function checksForNullish(test: TSESTree.Expression, variableName: string): boolean {
  // if (item)
  if (test.type === AST_NODE_TYPES.Identifier && test.name === variableName) {
    return true;
  }

  // if (!item) - falsy 체크도 nullish 체크로 인정
  if (test.type === AST_NODE_TYPES.UnaryExpression && test.operator === '!') {
    if (test.argument.type === AST_NODE_TYPES.Identifier && test.argument.name === variableName) {
      return true;
    }
  }

  // if (item !== null), if (item !== undefined), if (item != null)
  if (test.type === AST_NODE_TYPES.BinaryExpression) {
    return isBinaryNullCheck(test, variableName);
  }

  // if (item !== null && item !== undefined)
  if (test.type === AST_NODE_TYPES.LogicalExpression && test.operator === '&&') {
    return checksForNullish(test.left, variableName) || checksForNullish(test.right, variableName);
  }

  // if (item == null || item.length === 0) - OR 조건에서도 null 체크가 포함되면 인정
  // early exit 후에는 item이 null이 아님이 보장됨
  if (test.type === AST_NODE_TYPES.LogicalExpression && test.operator === '||') {
    return checksForNullish(test.left, variableName) || checksForNullish(test.right, variableName);
  }

  return false;
}

/**
 * 배열 인덱스 접근 표현식이 null/undefined 체크되는지 확인
 */
function checksForNullishExpression(test: TSESTree.Expression, expressionKey: string): boolean {
  // if (arr[0])
  if (test.type === AST_NODE_TYPES.MemberExpression) {
    const testKey = getArrayIndexAccessKey(test);
    return testKey === expressionKey;
  }

  // if (arr[0] !== null), if (arr[0] !== undefined), if (arr[0] != null)
  if (test.type === AST_NODE_TYPES.BinaryExpression) {
    return isBinaryNullCheckForExpression(test, expressionKey);
  }

  // if (arr[0] !== null && arr[0] !== undefined)
  if (test.type === AST_NODE_TYPES.LogicalExpression && test.operator === '&&') {
    return (
      checksForNullishExpression(test.left, expressionKey) || checksForNullishExpression(test.right, expressionKey)
    );
  }

  return false;
}

/**
 * if 문의 consequent 블록 내부인지 확인 (변수)
 */
function isInsideIfConsequent(node: TSESTree.Node, ifStatement: TSESTree.IfStatement, variableName: string): boolean {
  if (!checksForNullish(ifStatement.test, variableName)) {
    return false;
  }

  return ifStatement.consequent ? isDescendant(ifStatement.consequent, node) : false;
}

/**
 * 블록 또는 문장에 throw/return이 있는지 확인
 */
function hasEarlyExit(statement: TSESTree.Statement): boolean {
  if (statement.type === AST_NODE_TYPES.ThrowStatement || statement.type === AST_NODE_TYPES.ReturnStatement) {
    return true;
  }

  if (statement.type === AST_NODE_TYPES.BlockStatement) {
    return statement.body.some((stmt) => hasEarlyExit(stmt));
  }

  return false;
}

/**
 * if 문의 consequent 블록 내부인지 확인 (표현식)
 */
function isInsideIfConsequentExpression(
  node: TSESTree.Node,
  ifStatement: TSESTree.IfStatement,
  expressionKey: string
): boolean {
  if (!checksForNullishExpression(ifStatement.test, expressionKey)) {
    return false;
  }

  return ifStatement.consequent ? isDescendant(ifStatement.consequent, node) : false;
}

/**
 * if 문에서 null 체크 후 throw/return하는 경우, 그 이후는 안전
 */
function isAfterNullCheckWithEarlyExit(
  node: TSESTree.Node,
  ifStatement: TSESTree.IfStatement,
  expressionKey: string
): boolean {
  // if (arr[0] == null) throw ... 형태 체크
  if (!checksForNullishExpression(ifStatement.test, expressionKey)) {
    return false;
  }

  // consequent에 throw/return이 있는지 확인
  if (!hasEarlyExit(ifStatement.consequent)) {
    return false;
  }

  // 현재 노드가 if 문 이후에 있는지 확인
  // if 문과 같은 부모(블록)를 가지고 있고, if 문 이후에 위치해야 함
  const ifParent = ifStatement.parent;
  if (!ifParent || ifParent.type !== AST_NODE_TYPES.BlockStatement) {
    return false;
  }

  const ifIndex = ifParent.body.indexOf(ifStatement);
  if (ifIndex === -1) {
    return false;
  }

  // 현재 노드가 if 문 이후의 문장들 중 하나의 자손인지 확인
  for (let i = ifIndex + 1; i < ifParent.body.length; i++) {
    if (isDescendant(ifParent.body[i], node) || ifParent.body[i] === node) {
      return true;
    }
  }

  return false;
}

/**
 * 논리 AND의 오른쪽에서 사용되는지 확인 (변수)
 */
function isInsideLogicalAndRight(
  node: TSESTree.Node,
  logicalExpr: TSESTree.LogicalExpression,
  variableName: string
): boolean {
  if (logicalExpr.operator !== '&&') {
    return false;
  }

  if (logicalExpr.left.type !== AST_NODE_TYPES.Identifier || logicalExpr.left.name !== variableName) {
    return false;
  }

  return isDescendant(logicalExpr.right, node);
}

/**
 * 논리 AND의 오른쪽에서 사용되는지 확인 (표현식)
 */
function isInsideLogicalAndRightExpression(
  node: TSESTree.Node,
  logicalExpr: TSESTree.LogicalExpression,
  expressionKey: string
): boolean {
  if (logicalExpr.operator !== '&&') {
    return false;
  }

  if (logicalExpr.left.type !== AST_NODE_TYPES.MemberExpression) {
    return false;
  }

  const leftKey = getArrayIndexAccessKey(logicalExpr.left);
  if (leftKey !== expressionKey) {
    return false;
  }

  return isDescendant(logicalExpr.right, node);
}

/**
 * 변수가 null 체크된 블록 내부인지 확인
 */
function isInsideNullCheckedBlock(node: TSESTree.Node, variableName: string): boolean {
  // 먼저 이전 if 문들에서 early exit 패턴 확인
  if (checkPreviousIfStatementsForVariable(node, variableName)) {
    return true;
  }

  let current: TSESTree.Node | undefined = node.parent;

  while (current) {
    // if 문의 consequent 블록 내부인지 확인
    if (current.type === AST_NODE_TYPES.IfStatement) {
      if (isInsideIfConsequent(node, current, variableName)) {
        return true;
      }
    }

    // 논리 AND의 오른쪽에서 사용되는 경우: item && item.foo
    if (current.type === AST_NODE_TYPES.LogicalExpression) {
      if (isInsideLogicalAndRight(node, current, variableName)) {
        return true;
      }
    }

    current = current.parent;
  }

  return false;
}

/**
 * 노드가 속한 문장을 찾음
 */
function findContainingStatement(node: TSESTree.Node): TSESTree.Node | null {
  let statement: TSESTree.Node | undefined = node;
  while (statement?.parent) {
    const parentType = statement.parent.type;
    if (parentType === AST_NODE_TYPES.BlockStatement || parentType === AST_NODE_TYPES.Program) {
      return statement;
    }
    statement = statement.parent;
  }
  return null;
}

/**
 * 블록 또는 프로그램에서 문장 목록 가져오기
 */
function getStatements(parent: TSESTree.Node): TSESTree.Statement[] | null {
  if (parent.type === AST_NODE_TYPES.BlockStatement || parent.type === AST_NODE_TYPES.Program) {
    return parent.body;
  }
  return null;
}

/**
 * 이전 if 문에서 early exit 패턴이 있는지 확인 (표현식)
 */
function hasEarlyExitPatternForExpression(prevStatement: TSESTree.Statement, expressionKey: string): boolean {
  return (
    prevStatement.type === AST_NODE_TYPES.IfStatement &&
    checksForNullishExpression(prevStatement.test, expressionKey) &&
    hasEarlyExit(prevStatement.consequent)
  );
}

/**
 * 조건식이 falsy 체크인지 확인 (표현식): if (!expr) 형태
 */
function isFalsyCheckExpression(test: TSESTree.Expression, expressionKey: string): boolean {
  // if (!expr) 형태
  if (test.type === AST_NODE_TYPES.UnaryExpression && test.operator === '!') {
    if (test.argument.type === AST_NODE_TYPES.MemberExpression) {
      const argKey = getArrayIndexAccessKey(test.argument);
      return argKey === expressionKey;
    }
  }
  return false;
}

/**
 * 블록 내에서 표현식에 값이 할당되는지 확인
 */
function hasAssignmentToExpression(statement: TSESTree.Statement, expressionKey: string): boolean {
  // 단일 표현식 문장인 경우
  if (statement.type === AST_NODE_TYPES.ExpressionStatement) {
    const expr = statement.expression;
    if (expr.type === AST_NODE_TYPES.AssignmentExpression && expr.left.type === AST_NODE_TYPES.MemberExpression) {
      const leftKey = getArrayIndexAccessKey(expr.left);
      return leftKey === expressionKey;
    }
  }

  // 블록 문장인 경우
  if (statement.type === AST_NODE_TYPES.BlockStatement) {
    return statement.body.some((stmt) => hasAssignmentToExpression(stmt, expressionKey));
  }

  return false;
}

/**
 * if (!expr) { expr = value; } 패턴 체크 (표현식)
 * 이 패턴 이후에는 expr이 반드시 값을 가지므로 안전
 */
function hasInitializationPatternForExpression(prevStatement: TSESTree.Statement, expressionKey: string): boolean {
  if (prevStatement.type !== AST_NODE_TYPES.IfStatement) {
    return false;
  }

  // if (!expr) 형태인지 확인
  if (!isFalsyCheckExpression(prevStatement.test, expressionKey)) {
    return false;
  }

  // consequent에서 expr = value 형태의 할당이 있는지 확인
  return hasAssignmentToExpression(prevStatement.consequent, expressionKey);
}

/**
 * 이전 if 문에서 early exit 패턴이 있는지 확인 (변수)
 */
function hasEarlyExitPatternForVariable(prevStatement: TSESTree.Statement, variableName: string): boolean {
  return (
    prevStatement.type === AST_NODE_TYPES.IfStatement &&
    checksForNullish(prevStatement.test, variableName) &&
    hasEarlyExit(prevStatement.consequent)
  );
}

/**
 * 현재 노드가 속한 블록에서 이전에 나온 if 문들을 확인 (표현식)
 */
function checkPreviousIfStatementsForExpression(node: TSESTree.Node, expressionKey: string): boolean {
  const statement = findContainingStatement(node);
  if (!statement?.parent) {
    return false;
  }

  const statements = getStatements(statement.parent);
  if (!statements) {
    return false;
  }

  const statementIndex = statements.indexOf(statement as TSESTree.Statement);
  if (statementIndex === -1) {
    return false;
  }

  // 이전 문장들 중에서 안전 패턴 찾기
  for (let i = 0; i < statementIndex; i++) {
    const prevStatement = statements[i];
    // 1. if (arr[0] == null) throw ... 패턴
    if (hasEarlyExitPatternForExpression(prevStatement, expressionKey)) {
      return true;
    }
    // 2. if (!arr[0]) { arr[0] = value; } 패턴
    if (hasInitializationPatternForExpression(prevStatement, expressionKey)) {
      return true;
    }
  }

  return false;
}

/**
 * 현재 노드가 속한 블록에서 이전에 나온 if 문들을 확인 (변수)
 */
function checkPreviousIfStatementsForVariable(node: TSESTree.Node, variableName: string): boolean {
  const statement = findContainingStatement(node);
  if (!statement?.parent) {
    return false;
  }

  const statements = getStatements(statement.parent);
  if (!statements) {
    return false;
  }

  const statementIndex = statements.indexOf(statement as TSESTree.Statement);
  if (statementIndex === -1) {
    return false;
  }

  // 이전 문장들 중에서 if (item == null) throw ... 패턴 찾기
  for (let i = 0; i < statementIndex; i++) {
    if (hasEarlyExitPatternForVariable(statements[i], variableName)) {
      return true;
    }
  }

  return false;
}

/**
 * 배열 인덱스 접근 표현식이 null 체크된 블록 내부인지 확인
 */
function isInsideNullCheckedBlockExpression(node: TSESTree.Node, expressionKey: string): boolean {
  // 먼저 이전 if 문들에서 early exit 패턴 확인
  if (checkPreviousIfStatementsForExpression(node, expressionKey)) {
    return true;
  }

  let current: TSESTree.Node | undefined = node.parent;

  while (current) {
    // if 문의 consequent 블록 내부인지 확인
    if (current.type === AST_NODE_TYPES.IfStatement) {
      if (isInsideIfConsequentExpression(node, current, expressionKey)) {
        return true;
      }
    }

    // 논리 AND의 오른쪽에서 사용되는 경우: arr[0] && arr[0].foo
    if (current.type === AST_NODE_TYPES.LogicalExpression) {
      if (isInsideLogicalAndRightExpression(node, current, expressionKey)) {
        return true;
      }
    }

    current = current.parent;
  }

  return false;
}

/**
 * 직접 프로퍼티 접근 케이스 확인: arr[0].foo
 */
function isUnsafePropertyAccess(node: TSESTree.MemberExpression, parent: TSESTree.Node | undefined): boolean {
  return (
    parent?.type === AST_NODE_TYPES.MemberExpression &&
    parent.object === node &&
    !hasOptionalChaining(parent) &&
    !isInsideNullCheck(node)
  );
}

/**
 * 직접 함수 호출 케이스 확인: arr[0]()
 */
function isUnsafeFunctionCall(node: TSESTree.MemberExpression, parent: TSESTree.Node | undefined): boolean {
  return (
    parent?.type === AST_NODE_TYPES.CallExpression &&
    parent.callee === node &&
    !hasOptionalChaining(node) &&
    !isInsideNullCheck(node)
  );
}

/**
 * 변수가 배열 인덱스로 초기화되었는지 확인
 */
function getArrayIndexVariableName(node: TSESTree.Node): string | null {
  // const item = arr[0] 형태에서 변수명 추출
  if (node.parent?.type === AST_NODE_TYPES.VariableDeclarator) {
    const declarator = node.parent;
    if (declarator.id.type === AST_NODE_TYPES.Identifier && declarator.init === node) {
      return declarator.id.name;
    }
  }
  return null;
}

export const arrayIndexCheckUndefined = createRule<Options, MessageIds>({
  name: 'array-index-check-undefined',
  meta: {
    docs: {
      description: 'Enforce undefined check when accessing array elements by index to prevent runtime errors',
    },
    type: 'problem',
    schema: [],
    messages: {
      'issue:unsafe-access':
        'Array index access may return undefined. Use optional chaining (?.), nullish coalescing (??), or check for undefined before accessing properties.',
      'issue:unsafe-usage': 'Array index access may return undefined. Ensure the value is checked before use.',
    },
  },
  defaultOptions: [],
  create: (context) => {
    // 배열 인덱스로 초기화된 변수 선언 노드들을 추적 (스코프 고려)
    const arrayIndexDeclarations = new Set<TSESTree.VariableDeclarator>();

    // TypeScript 타입 정보 가져오기 (선택적)
    let services: ParserServicesWithTypeInformation | null = null;
    try {
      const parserServices = ESLintUtils.getParserServices(context);
      if (parserServices.program) {
        services = parserServices;
      }
    } catch {
      // 타입 정보 없이도 동작 가능
    }

    /**
     * 변수가 배열 인덱스로 초기화된 변수인지 스코프를 고려하여 확인
     */
    function isArrayIndexVariable(node: TSESTree.Identifier): boolean {
      const scope = context.sourceCode.getScope(node);

      // 현재 스코프에서 변수 참조 찾기
      let currentScope: typeof scope | null = scope;
      while (currentScope) {
        for (const variable of currentScope.variables) {
          if (variable.name === node.name) {
            // 변수 정의가 arrayIndexDeclarations에 있는지 확인
            for (const def of variable.defs) {
              if (def.node.type === AST_NODE_TYPES.VariableDeclarator) {
                if (arrayIndexDeclarations.has(def.node)) {
                  return true;
                }
              }
            }
            // 변수를 찾았지만 arrayIndexDeclarations에 없으면 false
            // (함수 파라미터, 다른 방식으로 초기화된 변수 등)
            return false;
          }
        }
        currentScope = currentScope.upper;
      }

      return false;
    }

    return {
      // 변수 선언 추적
      VariableDeclarator: (node: TSESTree.VariableDeclarator) => {
        if (
          node.init?.type === AST_NODE_TYPES.MemberExpression &&
          isArrayIndexAccess(node.init) &&
          node.id.type === AST_NODE_TYPES.Identifier
        ) {
          // TypeScript 타입 정보로 안전한 접근인 경우 추적하지 않음
          // (예: Record<EnumType, ValueType>에서 enum 키로 접근)
          if (isSafeKeyAccess(node.init, services)) {
            return;
          }
          arrayIndexDeclarations.add(node);
        }
      },

      // 배열 인덱스 직접 접근 체크
      MemberExpression: (node: TSESTree.MemberExpression) => {
        if (!isArrayIndexAccess(node)) {
          return;
        }

        const parent = node.parent;

        // 변수에 할당되는 경우는 여기서 체크하지 않음
        const variableName = getArrayIndexVariableName(node);
        if (variableName) {
          return;
        }

        // TypeScript 타입 정보로 안전한 접근인지 확인
        // (예: keyof 타입, enum 키, 리터럴 union 타입)
        if (isSafeKeyAccess(node, services)) {
          return;
        }

        // for 문 내부에서 인덱스 조건으로 보호되는 경우 안전
        // (예: for (let i = 0; i < arr.length; i++) { arr[i].foo })
        if (isInsideSafeForLoop(node)) {
          return;
        }

        // 배열 인덱스 접근 표현식이 null 체크되었는지 확인
        const expressionKey = getArrayIndexAccessKey(node);
        if (expressionKey && isInsideNullCheckedBlockExpression(node, expressionKey)) {
          return;
        }

        // Case 1: arr[0].foo - 직접 프로퍼티 접근
        if (isUnsafePropertyAccess(node, parent)) {
          context.report({ node, messageId: 'issue:unsafe-access' });
          return;
        }

        // Case 2: arr[0]() - 직접 함수 호출
        if (isUnsafeFunctionCall(node, parent)) {
          context.report({ node, messageId: 'issue:unsafe-access' });
        }
      },

      // 변수를 통한 프로퍼티 접근 체크
      'MemberExpression[object.type="Identifier"]': (node: TSESTree.MemberExpression) => {
        const objectNode = node.object as TSESTree.Identifier;

        // 스코프를 고려하여 배열 인덱스 변수인지 확인
        if (isArrayIndexVariable(objectNode)) {
          // Optional chaining 사용 시 안전
          if (hasOptionalChaining(node)) {
            return;
          }

          // null 체크된 블록 내부인지 확인
          if (isInsideNullCheckedBlock(node, objectNode.name)) {
            return;
          }

          context.report({ node: objectNode, messageId: 'issue:unsafe-access' });
        }
      },

      // 변수를 통한 함수 호출 체크
      'CallExpression[callee.type="Identifier"]': (node: TSESTree.CallExpression) => {
        const calleeNode = node.callee as TSESTree.Identifier;

        // 스코프를 고려하여 배열 인덱스 변수인지 확인
        if (isArrayIndexVariable(calleeNode)) {
          // null 체크된 블록 내부인지 확인
          if (isInsideNullCheckedBlock(node, calleeNode.name)) {
            return;
          }

          context.report({ node: calleeNode, messageId: 'issue:unsafe-access' });
        }
      },
    };
  },
});
