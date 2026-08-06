export function getFormPublicPath(formId) {
  return `/f/${formId}`;
}

export function getFormPublicUrl(formId) {
  if (typeof window === 'undefined') return getFormPublicPath(formId);
  return `${window.location.origin}${getFormPublicPath(formId)}`;
}

export async function copyFormPublicLink(formId) {
  const url = getFormPublicUrl(formId);
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return url;
  }

  const input = document.createElement('input');
  input.value = url;
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  document.body.removeChild(input);
  return url;
}
