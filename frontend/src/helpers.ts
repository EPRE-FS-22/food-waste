export const base64Decode = (text: string) => {
  return decodeURIComponent(
    escape(
      window.atob(text.replace(/_/g, '/').replace(/-/g, '+').replace(/~/g, '='))
    )
  );
};
