function linkify(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, (url) => {
      return `<a href="${url}" target="_blank">${url}</a>`;
  });
}

module.exports = {
  linkify
}