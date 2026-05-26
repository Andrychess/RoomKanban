/** Сериализует асинхронные операции в одном процессе (очередь на Promise). */
export class AsyncMutex {
  private tail: Promise<void> = Promise.resolve()

  run<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.tail.then(() => fn())
    this.tail = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }
}
