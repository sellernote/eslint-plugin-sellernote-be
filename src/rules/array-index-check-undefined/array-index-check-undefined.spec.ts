import { RuleTester } from '@typescript-eslint/rule-tester';
import * as path from 'path';

import { arrayIndexCheckUndefined } from '.';

// TypeScript 타입 정보를 사용하는 테스트를 위한 설정
const ruleTesterWithTypes = new RuleTester({
  languageOptions: {
    parserOptions: {
      project: path.join(__dirname, '../../fixtures/tsconfig.json'),
      tsconfigRootDir: path.join(__dirname, '../../fixtures'),
    },
  },
});

const ruleTester = new RuleTester();

ruleTester.run('array-index-check-undefined', arrayIndexCheckUndefined, {
  valid: [
    // Optional chaining 사용
    {
      code: `
        const arr = [1, 2, 3];
        const value = arr[0]?.toString();
      `,
    },
    // Nullish coalescing 사용
    {
      code: `
        const arr = [1, 2, 3];
        const value = arr[0] ?? 'default';
      `,
    },
    // If 조건문으로 체크
    {
      code: `
        const arr = [1, 2, 3];
        if (arr[0]) {
          console.log(arr[0].toString());
        }
      `,
    },
    // undefined 체크
    {
      code: `
        const arr = [1, 2, 3];
        if (arr[0] !== undefined) {
          console.log(arr[0].toString());
        }
      `,
    },
    // 논리 AND 연산자로 체크
    {
      code: `
        const arr = [1, 2, 3];
        arr[0] && arr[0].toString();
      `,
    },
    // 삼항 연산자 사용
    {
      code: `
        const arr = [1, 2, 3];
        const value = arr[0] ? arr[0].toString() : 'default';
      `,
    },
    // 단순 인덱스 접근 (프로퍼티 접근 없음)
    {
      code: `
        const arr = [1, 2, 3];
        const value = arr[0];
      `,
    },
    // 객체의 문자열 키 접근은 해당 안됨
    {
      code: `
        const obj = { foo: 'bar' };
        const value = obj['foo'].toUpperCase();
      `,
    },
    // Optional chaining으로 메서드 호출
    {
      code: `
        const arr = [{ name: 'test' }];
        const value = arr[0]?.name.toUpperCase();
      `,
    },
    // 변수에 할당 후 null 체크
    {
      code: `
        const arr = [1, 2, 3];
        const item = arr[0];
        if (item) {
          console.log(item.toString());
        }
      `,
    },
    // 변수에 할당 후 !== undefined 체크
    {
      code: `
        const arr = [1, 2, 3];
        const item = arr[0];
        if (item !== undefined) {
          console.log(item.toString());
        }
      `,
    },
    // 변수에 할당 후 !== null 체크
    {
      code: `
        const arr = [1, 2, 3];
        const item = arr[0];
        if (item !== null) {
          console.log(item.toString());
        }
      `,
    },
    // 변수에 할당 후 != null 체크 (느슨한 비교)
    {
      code: `
        const arr = [1, 2, 3];
        const item = arr[0];
        if (item != null) {
          console.log(item.toString());
        }
      `,
    },
    // 변수에 할당 후 && 연산자로 체크
    {
      code: `
        const arr = [1, 2, 3];
        const item = arr[0];
        item && item.toString();
      `,
    },
    // 변수에 할당 후 복합 조건으로 체크
    {
      code: `
        const arr = [1, 2, 3];
        const item = arr[0];
        if (item !== null && item !== undefined) {
          console.log(item.toString());
        }
      `,
    },
    // 변수에 할당 후 optional chaining 사용
    {
      code: `
        const arr = [{ name: 'test' }];
        const item = arr[0];
        const name = item?.name;
      `,
    },
    // 변수에 할당 후 null 체크 후 throw - 안전
    {
      code: `
        const ports = [{ id: 1 }];
        const polPort = ports[0];
        if (polPort == null) {
          throw new Error('invalid');
        }
        polPort.id = 123;
      `,
    },
    // 변수에 할당 후 !== null 체크 후 return - 안전
    {
      code: `
        const ports = [{ id: 1 }];
        const polPort = ports[0];
        if (polPort === null) {
          return;
        }
        polPort.id = 123;
      `,
    },
    // 변수에 할당 후 !variable 체크 후 throw - 안전
    {
      code: `
        const products = [{ productName: 'test' }];
        const mainProduct = products[0];
        if (!mainProduct) {
          throw new Error('products is empty');
        }
        const name = mainProduct.productName;
      `,
    },
    // 변수에 할당 후 !variable 체크 후 return - 안전
    {
      code: `
        const items = [{ value: 1 }];
        const firstItem = items[0];
        if (!firstItem) {
          return null;
        }
        return firstItem.value;
      `,
    },
    // 변수에 할당 후 || 조건으로 null 체크 후 return - 안전
    {
      code: `
        const map: Record<string, { id: number }[]> = {};
        const statusEvents = map['key'];
        if (statusEvents == null || statusEvents.length === 0) {
          return null;
        }
        return statusEvents.map(e => e.id);
      `,
    },
    // 변수에 할당 후 || 조건으로 null 체크 후 return - 복잡한 케이스
    {
      code: `
        interface Event { id: number; name: string; }
        const eventMap: Record<string, Event[]> = {};
        const events = eventMap['status'];
        if (events == null || events.length === 0) {
          return { empty: true };
        }
        return events.map(event => ({
          eventId: event.id,
          eventName: event.name,
        }));
      `,
    },
    // 배열 인덱스 접근 자체를 null 체크 - if 블록
    {
      code: `
        const payload = { bindList: [{ teamId: 1 }] };
        if (payload.bindList[0] == null) {
          throw new Error('invalid');
        }
        payload.bindList[0].teamId = 123;
      `,
    },
    // 배열 인덱스 접근 자체를 null 체크 - !== undefined
    {
      code: `
        const payload = { bindList: [{ teamId: 1 }] };
        if (payload.bindList[0] !== undefined) {
          payload.bindList[0].teamId = 123;
        }
      `,
    },
    // 배열 인덱스 접근 자체를 null 체크 - !== null
    {
      code: `
        const payload = { bindList: [{ teamId: 1 }] };
        if (payload.bindList[0] !== null) {
          payload.bindList[0].teamId = 123;
        }
      `,
    },
    // 배열 인덱스 접근 자체를 null 체크 - 논리 AND
    {
      code: `
        const payload = { bindList: [{ teamId: 1 }] };
        payload.bindList[0] && (payload.bindList[0].teamId = 123);
      `,
    },
    // 배열 인덱스 접근 자체를 null 체크 - truthy 체크
    {
      code: `
        const arr = [{ name: 'test' }];
        if (arr[0]) {
          arr[0].name = 'updated';
        }
      `,
    },
    // falsy 체크 후 값 초기화 패턴 - reduce 패턴
    {
      code: `
        interface Item { domain: string; }
        const payload: Item[] = [];
        const grouped = payload.reduce((acc, item) => {
          const domain = item.domain;
          if (!acc[domain]) {
            acc[domain] = [];
          }
          acc[domain].push(item);
          return acc;
        }, {} as Record<string, Item[]>);
      `,
    },
    // falsy 체크 후 값 초기화 패턴 - 단순 케이스
    {
      code: `
        const obj: Record<string, number[]> = {};
        const key = 'test';
        if (!obj[key]) {
          obj[key] = [];
        }
        obj[key].push(1);
      `,
    },
    // for 문 내부에서 인덱스로 접근 - 안전
    {
      code: `
        interface Route { lat: number; lng: number; }
        const routes: Route[] = [];
        for (let i = 0; i < routes.length; i++) {
          console.log(routes[i].lat);
          console.log(routes[i].lng);
        }
      `,
    },
    // for 문 내부에서 중첩 프로퍼티 접근 - 안전
    {
      code: `
        interface Item { data: { value: number } }
        const items: Item[] = [];
        for (let i = 0; i < items.length; i++) {
          console.log(items[i].data.value);
        }
      `,
    },
    // for 문 내부에서 메서드 호출 - 안전
    {
      code: `
        const numbers: number[] = [1, 2, 3];
        for (let i = 0; i < numbers.length; i++) {
          console.log(numbers[i].toString());
        }
      `,
    },
    // for 문 - 중첩 객체의 배열 접근
    {
      code: `
        interface Data { routes: { lat: number; lng: number }[] }
        const data: Data = { routes: [] };
        for (let i = 0; i < data.routes.length; i++) {
          console.log(data.routes[i].lat);
        }
      `,
    },
    // 함수 파라미터로 받은 변수는 배열 인덱스 변수가 아님 (스코프 구분)
    {
      code: `
        interface Fare { getColumnValue(column: string): number }
        
        // 다른 곳에서 같은 이름의 변수가 배열 인덱스로 초기화됨
        const fares = [{ getColumnValue: (c: string) => 0 }];
        const fare = fares[0];
        
        // 함수 파라미터로 받은 fare는 다른 변수임
        function calcFare(fare: Fare): number {
          const column = 'section1';
          return fare.getColumnValue(column);
        }
      `,
    },
    // 함수 파라미터 - 복잡한 케이스
    {
      code: `
        interface Fare { getColumnValue(column: string): number }
        const fares: Fare[] = [];
        const fare = fares[0];
        
        class Calculator {
          public calc(fare: Fare): number {
            const solePrice = fare.getColumnValue('section1') || 0;
            return solePrice;
          }
        }
      `,
    },
  ],
  invalid: [
    // 직접 프로퍼티 접근 - 위험
    {
      code: `
        const arr = [1, 2, 3];
        const value = arr[0].toString();
      `,
      errors: [{ messageId: 'issue:unsafe-access' }],
    },
    // 변수 인덱스로 접근 후 프로퍼티 접근
    {
      code: `
        const arr = [1, 2, 3];
        const i = 0;
        const value = arr[i].toString();
      `,
      errors: [{ messageId: 'issue:unsafe-access' }],
    },
    // 표현식 인덱스로 접근 후 프로퍼티 접근
    {
      code: `
        const arr = [1, 2, 3];
        const value = arr[0 + 1].toString();
      `,
      errors: [{ messageId: 'issue:unsafe-access' }],
    },
    // 배열 요소를 직접 함수로 호출
    {
      code: `
        const callbacks = [() => console.log('test')];
        callbacks[0]();
      `,
      errors: [{ messageId: 'issue:unsafe-access' }],
    },
    // 중첩 배열 접근 - 두 번의 인덱스 접근 모두 위험
    {
      code: `
        const matrix = [[1, 2], [3, 4]];
        const value = matrix[0][0].toString();
      `,
      errors: [{ messageId: 'issue:unsafe-access' }, { messageId: 'issue:unsafe-access' }],
    },
    // 변수에 할당 후 null 체크 없이 사용
    {
      code: `
        const arr = [1, 2, 3];
        const item = arr[0];
        console.log(item.toString());
      `,
      errors: [{ messageId: 'issue:unsafe-access' }],
    },
    // 변수에 할당 후 null 체크 없이 프로퍼티 접근
    {
      code: `
        const arr = [{ name: 'test' }];
        const item = arr[0];
        console.log(item.name);
      `,
      errors: [{ messageId: 'issue:unsafe-access' }],
    },
    // 변수에 할당 후 null 체크 없이 함수 호출
    {
      code: `
        const callbacks = [() => console.log('test')];
        const callback = callbacks[0];
        callback();
      `,
      errors: [{ messageId: 'issue:unsafe-access' }],
    },
    // if 블록 외부에서 사용
    {
      code: `
        const arr = [1, 2, 3];
        const item = arr[0];
        if (item) {
          console.log('exists');
        }
        console.log(item.toString());
      `,
      errors: [{ messageId: 'issue:unsafe-access' }],
    },
    // 배열 인덱스 접근 자체를 null 체크하지 않음
    {
      code: `
        const payload = { bindList: [{ teamId: 1 }] };
        payload.bindList[0].teamId = 123;
      `,
      errors: [{ messageId: 'issue:unsafe-access' }],
    },
    // 배열 인덱스 접근 자체 - if 블록 외부에서 사용
    {
      code: `
        const payload = { bindList: [{ teamId: 1 }] };
        if (payload.bindList[0]) {
          console.log('exists');
        }
        payload.bindList[0].teamId = 123;
      `,
      errors: [{ messageId: 'issue:unsafe-access' }],
    },
  ],
});

// TypeScript 타입 정보를 사용하는 테스트 (keyof, enum 등)
ruleTesterWithTypes.run('array-index-check-undefined (with types)', arrayIndexCheckUndefined, {
  valid: [
    // keyof 타입으로 제한된 키로 Record 접근 - 안전
    {
      code: `
        const FORM = {
          CONTAINER: { name: 'container' },
          USER: { name: 'user' },
        } as const;
        
        function getName<T extends keyof typeof FORM>(key: T) {
          return FORM[key].name;
        }
      `,
    },
    // 제네릭으로 제한된 키로 접근 - 안전
    {
      code: `
        interface Config {
          apiUrl: string;
          timeout: number;
        }
        
        function getConfig<K extends keyof Config>(config: Config, key: K): Config[K] {
          return config[key];
        }
      `,
    },
    // enum 키로 Record 접근 - 안전
    {
      code: `
        enum TableInfo {
          CONTAINER = 'CONTAINER',
          USER = 'USER',
        }
        
        const TABLE_FORM = {
          [TableInfo.CONTAINER]: { name: 'container' },
          [TableInfo.USER]: { name: 'user' },
        } as const;
        
        function getTableName(key: TableInfo) {
          return TABLE_FORM[key].name;
        }
      `,
    },
    // Record<EnumType, ValueType> 타입에서 enum 파라미터로 접근 - 안전
    {
      code: `
        enum ExcelFormat {
          FORMAT_A = 'FORMAT_A',
          FORMAT_B = 'FORMAT_B',
        }
        
        interface ExcelTransformer {
          getConfig(): { name: string };
          transform(data: any[]): any[];
        }
        
        class ExcelService {
          private transformerMap: Record<ExcelFormat, ExcelTransformer> = {} as any;
          
          createExcelFile(data: any[], key: ExcelFormat) {
            const transformer = this.transformerMap[key];
            const config = transformer.getConfig();
            return transformer.transform(data);
          }
        }
      `,
    },
    // Record<EnumType, ValueType> 타입 - 메서드 체이닝
    {
      code: `
        enum Format { A = 'A', B = 'B' }
        interface Transformer { getValue(): number }
        
        function process(map: Record<Format, Transformer>, key: Format) {
          return map[key].getValue();
        }
      `,
    },
  ],
  invalid: [],
});
