declare module 'promptpay-qr' {
  function promptpayQR(target: string, options?: { amount?: number }): string;
  export = promptpayQR;
}
