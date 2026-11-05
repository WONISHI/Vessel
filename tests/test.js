function test(n) {
  if (n > 2) {
    test(n - 1)
  }
  console.log("n=", n)
}
test(4)
