const hash = document.querySelector("#hash");

export function renderHash(count, cells) {
  const hashLength = cells / 4; // Each hexadecimal character represents 4 bits
  hash.textContent = `${count.toString(16)}`;
  //.padStart(hashLength, 0)
}
