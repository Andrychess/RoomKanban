function installPdfRuntimePolyfills(): void {
  if (!('getOrInsertComputed' in Map.prototype)) {
    Object.defineProperty(Map.prototype, 'getOrInsertComputed', {
      value<T, K>(this: Map<K, T>, key: K, callbackFn: (key: K) => T): T {
        if (this.has(key)) return this.get(key) as T
        const value = callbackFn(key)
        this.set(key, value)
        return value
      },
      writable: true,
      configurable: true
    })
  }

  if (!('toHex' in Uint8Array.prototype)) {
    Object.defineProperty(Uint8Array.prototype, 'toHex', {
      value(this: Uint8Array): string {
        let hex = ''
        for (let i = 0; i < this.length; i++) {
          hex += this[i].toString(16).padStart(2, '0')
        }
        return hex
      },
      writable: true,
      configurable: true
    })
  }
}

installPdfRuntimePolyfills()
