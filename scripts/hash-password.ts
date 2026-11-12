import { hashPassword } from '../apps/api/src/auth/password';
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk: string) => {
  input += chunk;
});
process.stdin.on('end', () => {
  const password = input.replace(/\r?\n$/, '');
  if (password.length < 12) {
    console.error('Use at least 12 characters. Supply the password on stdin.');
    process.exitCode = 1;
    return;
  }
  console.log(hashPassword(password));
});
