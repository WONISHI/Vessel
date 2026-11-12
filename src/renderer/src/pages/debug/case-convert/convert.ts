/** Splits identifiers, including acronym boundaries, into reusable words. */
export function convertCase(input: string) {
  const words = input
    .replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, "$1 $2")
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, "$1 $2")
    .match(/[\p{L}\p{N}]+/gu)?.map((word) => word.toLowerCase()) ?? []
  const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)
  return [
    { label: "全小写", value: input.toLowerCase() },
    { label: "小驼峰", value: words.map((word, index) => index ? capitalize(word) : word).join("") },
    { label: "大驼峰", value: words.map(capitalize).join("") },
    { label: "短横线", value: words.join("-") },
    { label: "大写常量", value: words.join("_").toUpperCase() }
  ]
}
