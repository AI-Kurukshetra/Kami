import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const config = [...nextVitals, ...nextTypescript];

const finalConfig = [
  ...config,
  {
    ignores: ['playwright-report/**', 'test-results/**']
  }
];

export default finalConfig;
