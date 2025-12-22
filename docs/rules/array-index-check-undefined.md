# Enforce undefined check when accessing array elements by index (`array-index-check-undefined`)

<!-- end auto-generated rule header -->

배열에 인덱스로 접근할 때 `undefined`가 반환될 수 있으므로, 안전하게 접근하도록 강제합니다.

## Rule Details

배열의 인덱스 접근(`arr[0]`, `arr[i]` 등)은 해당 인덱스에 요소가 없을 경우 `undefined`를 반환합니다. 이 값에 바로 프로퍼티 접근이나 메서드 호출을 하면 런타임 에러가 발생할 수 있습니다.

이 규칙은 다음과 같은 안전한 패턴을 사용하도록 강제합니다:

- Optional chaining (`?.`)
- Nullish coalescing (`??`)
- 조건문을 통한 undefined 체크
- 논리 AND 연산자 (`&&`)
- **TypeScript 타입 시스템 활용** (keyof, enum 등)

또한 이 규칙은 **변수 추적 기능**을 지원합니다. 배열 인덱스 접근 결과를 변수에 할당한 후, 그 변수를 null/undefined 체크한 스코프 내에서는 에러를 발생시키지 않습니다.

**TypeScript 타입 정보 활용**: 프로젝트에 TypeScript 타입 정보가 설정되어 있으면, `keyof` 타입이나 `enum` 타입으로 제한된 키로 객체에 접근하는 경우 안전한 것으로 간주합니다.

## Examples

### Valid

```ts
// Optional chaining 사용
const arr = [1, 2, 3];
const value = arr[0]?.toString();

// Nullish coalescing 사용
const arr = [1, 2, 3];
const value = arr[0] ?? 'default';

// If 조건문으로 체크
const arr = [1, 2, 3];
if (arr[0]) {
  console.log(arr[0].toString());
}

// undefined 체크
const arr = [1, 2, 3];
if (arr[0] !== undefined) {
  console.log(arr[0].toString());
}

// 논리 AND 연산자로 체크
const arr = [1, 2, 3];
arr[0] && arr[0].toString();

// 삼항 연산자 사용
const arr = [1, 2, 3];
const value = arr[0] ? arr[0].toString() : 'default';

// 단순 인덱스 접근 (프로퍼티 접근 없음) - 허용
const arr = [1, 2, 3];
const value = arr[0];

// 변수에 할당 후 null 체크 - 안전
const arr = [1, 2, 3];
const item = arr[0];
if (item) {
  console.log(item.toString());
}

// 변수에 할당 후 명시적 undefined 체크 - 안전
const arr = [1, 2, 3];
const item = arr[0];
if (item !== undefined) {
  console.log(item.toString());
}

// 변수에 할당 후 != null 체크 - 안전
const arr = [1, 2, 3];
const item = arr[0];
if (item != null) {
  console.log(item.toString());
}

// 변수에 할당 후 논리 AND 연산자 - 안전
const arr = [1, 2, 3];
const item = arr[0];
item && item.toString();

// 변수에 할당 후 복합 조건 - 안전
const arr = [1, 2, 3];
const item = arr[0];
if (item !== null && item !== undefined) {
  console.log(item.toString());
}

// 변수에 할당 후 null 체크 후 throw - 안전
const ports = [{ id: 1 }];
const polPort = ports[0];
if (polPort == null) {
  throw new Error('invalid');
}
polPort.id = 123; // 여기는 안전 (위에서 throw됨)

// 변수에 할당 후 null 체크 후 return - 안전
const ports = [{ id: 1 }];
const polPort = ports[0];
if (polPort === null) {
  return;
}
polPort.id = 123; // 여기는 안전 (위에서 return됨)

// 변수에 할당 후 !variable 체크 후 throw - 안전
const products = [{ productName: 'test' }];
const mainProduct = products[0];
if (!mainProduct) {
  throw new Error('products is empty');
}
const name = mainProduct.productName; // 여기는 안전 (위에서 throw됨)

// 변수에 할당 후 || 조건으로 null 체크 후 return - 안전
interface Event {
  id: number;
}
const eventMap: Record<string, Event[]> = {};
const statusEvents = eventMap['status'];
if (statusEvents == null || statusEvents.length === 0) {
  return null;
}
return statusEvents.map((e) => e.id); // 여기는 안전 (위에서 return됨)

// 배열 인덱스 접근 자체를 null 체크 후 throw - 안전
const payload = { bindList: [{ teamId: 1 }] };
if (payload.bindList[0] == null) {
  throw new Error('invalid');
}
payload.bindList[0].teamId = 123; // 여기는 안전 (위에서 throw됨)

// 배열 인덱스 접근 자체를 null 체크 - if 블록 내부 안전
const payload = { bindList: [{ teamId: 1 }] };
if (payload.bindList[0] !== undefined) {
  payload.bindList[0].teamId = 123;
}

// 배열 인덱스 접근 자체를 논리 AND로 체크 - 안전
const payload = { bindList: [{ teamId: 1 }] };
payload.bindList[0] && (payload.bindList[0].teamId = 123);

// falsy 체크 후 값 초기화 패턴 (reduce 등에서 자주 사용)
interface Item {
  domain: string;
}
const items: Item[] = [];
const grouped = items.reduce(
  (acc, item) => {
    const domain = item.domain;
    if (!acc[domain]) {
      acc[domain] = []; // 값 초기화
    }
    acc[domain].push(item); // 안전 (위에서 초기화됨)
    return acc;
  },
  {} as Record<string, Item[]>
);

// for 문 내부에서 인덱스로 접근 - 안전
// (i < array.length 조건으로 인해 array[i]는 항상 유효함)
interface Route {
  lat: number;
  lng: number;
}
const routes: Route[] = [];
for (let i = 0; i < routes.length; i++) {
  console.log(routes[i].lat); // 안전
  console.log(routes[i].lng); // 안전
}

// 함수 파라미터는 배열 인덱스 변수가 아님 (스코프 구분)
// 다른 스코프에서 같은 이름의 변수가 배열 인덱스로 초기화되어도 영향 없음
interface Fare {
  getColumnValue(column: string): number;
}
const fares: Fare[] = [];
const fare = fares[0]; // 이 fare는 배열 인덱스 변수

function calcFare(fare: Fare): number {
  // 파라미터 fare는 다른 스코프이므로 안전
  return fare.getColumnValue('section1') || 0;
}

// keyof 타입으로 제한된 키로 접근 - 안전 (TypeScript 타입 정보 필요)
const FORM = {
  CONTAINER: { name: 'container' },
  USER: { name: 'user' },
} as const;

function getName<T extends keyof typeof FORM>(key: T) {
  return FORM[key].name; // key가 keyof typeof FORM으로 제한되어 있어 안전
}

// 제네릭 keyof 접근 - 안전 (TypeScript 타입 정보 필요)
interface Config {
  apiUrl: string;
  timeout: number;
}

function getConfig<K extends keyof Config>(config: Config, key: K): Config[K] {
  return config[key]; // key가 keyof Config로 제한되어 있어 안전
}

// enum 키로 Record 접근 - 안전 (TypeScript 타입 정보 필요)
enum TableInfo {
  CONTAINER = 'CONTAINER',
  USER = 'USER',
}

const TABLE_FORM = {
  [TableInfo.CONTAINER]: { name: 'container' },
  [TableInfo.USER]: { name: 'user' },
} as const;

function getTableName(key: TableInfo) {
  return TABLE_FORM[key].name; // key가 enum TableInfo로 제한되어 있어 안전
}

// Record<EnumType, ValueType> 타입에서 enum 파라미터로 접근 - 안전
enum ExcelFormat {
  FORMAT_A = 'FORMAT_A',
  FORMAT_B = 'FORMAT_B',
}

interface ExcelTransformer {
  getConfig(): { name: string };
}

class ExcelService {
  private transformerMap: Record<ExcelFormat, ExcelTransformer>;

  createExcelFile(key: ExcelFormat) {
    // enum 키로 Record에 접근하면 항상 값이 존재함이 보장됨
    const transformer = this.transformerMap[key];
    return transformer.getConfig(); // 안전
  }
}
```

### Invalid

```ts
// 직접 프로퍼티 접근 - 위험!
const arr = [1, 2, 3];
const value = arr[0].toString(); // Error!

// 변수 인덱스로 접근 후 프로퍼티 접근
const arr = [1, 2, 3];
const i = 0;
const value = arr[i].toString(); // Error!

// 배열 요소를 직접 함수로 호출
const callbacks = [() => console.log('test')];
callbacks[0](); // Error!

// 변수에 할당했지만 null 체크 없이 사용
const arr = [1, 2, 3];
const item = arr[0];
console.log(item.toString()); // Error!

// 변수에 할당했지만 프로퍼티 접근 시 null 체크 없음
const arr = [{ name: 'test' }];
const item = arr[0];
console.log(item.name); // Error!

// if 블록 외부에서 사용
const arr = [1, 2, 3];
const item = arr[0];
if (item) {
  console.log('exists'); // 여기는 안전
}
console.log(item.toString()); // Error! - if 블록 외부

// 배열 인덱스 접근 자체를 null 체크하지 않음
const payload = { bindList: [{ teamId: 1 }] };
payload.bindList[0].teamId = 123; // Error!

// 배열 인덱스 접근 - if 블록 외부에서 사용
const payload = { bindList: [{ teamId: 1 }] };
if (payload.bindList[0]) {
  console.log('exists'); // 여기는 안전
}
payload.bindList[0].teamId = 123; // Error! - if 블록 외부
```

## TypeScript 타입 정보 설정

`keyof` 타입이나 `enum` 타입 기반의 안전한 접근을 인식하려면 ESLint 설정에서 TypeScript 파서 서비스를 활성화해야 합니다:

```js
// eslint.config.js 또는 .eslintrc.js
module.exports = {
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
```

## When Not To Use It

- TypeScript의 `noUncheckedIndexedAccess` 옵션을 사용하는 경우
- 튜플 타입으로 배열 길이가 보장되는 경우
- 항상 요소가 존재함이 확실한 경우 (예: `array.length > 0` 체크 후)

## Related

- TypeScript `noUncheckedIndexedAccess` 컴파일러 옵션
