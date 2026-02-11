/**
 * Batch processing utility for handling large datasets efficiently
 * Prevents memory issues and database timeouts
 */

export interface BatchProcessorOptions<T, R> {
    items: T[];
    batchSize: number;
    processBatch: (batch: T[]) => Promise<R[]>;
    onProgress?: (completed: number, total: number) => void;
    onError?: (error: Error, batch: T[]) => Promise<boolean>; // Return true to continue, false to stop
    delayBetweenBatches?: number;
}

export interface BatchProcessorResult<R> {
    results: R[];
    processed: number;
    errors: number;
    durationMs: number;
}

/**
 * Process items in batches to prevent memory and performance issues
 */
export async function processInBatches<T, R>(
    options: BatchProcessorOptions<T, R>
): Promise<BatchProcessorResult<R>> {
    const {
        items,
        batchSize,
        processBatch,
        onProgress,
        onError,
        delayBetweenBatches = 0
    } = options;

    const startTime = Date.now();
    const results: R[] = [];
    let processed = 0;
    let errors = 0;

    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);

        try {
            const batchResults = await processBatch(batch);
            results.push(...batchResults);
            processed += batch.length;
        } catch (error) {
            errors++;
            console.error(`Error processing batch ${i / batchSize + 1}:`, error);

            if (onError) {
                const shouldContinue = await onError(error as Error, batch);
                if (!shouldContinue) {
                    break;
                }
            }
        }

        if (onProgress) {
            onProgress(Math.min(i + batchSize, items.length), items.length);
        }

        // Delay between batches to prevent overwhelming the system
        if (delayBetweenBatches > 0 && i + batchSize < items.length) {
            await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
    }

    return {
        results,
        processed,
        errors,
        durationMs: Date.now() - startTime
    };
}

/**
 * Process async operations with concurrency limiting
 */
export async function processWithConcurrency<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    concurrency: number = 5
): Promise<R[]> {
    const results: R[] = [];
    const executing: Promise<void>[] = [];

    for (const item of items) {
        const promise = processor(item).then(result => {
            results.push(result);
        });

        executing.push(promise);

        if (executing.length >= concurrency) {
            await Promise.race(executing);
            executing.splice(executing.findIndex(p => p === promise), 1);
        }
    }

    await Promise.all(executing);
    return results;
}

/**
 * Chunk an array into smaller arrays
 */
export function chunkArray<T>(items: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
        chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
}

/**
 * Process a stream of items with backpressure handling
 */
export async function* batchGenerator<T>(
    items: T[],
    batchSize: number
): AsyncGenerator<T[]> {
    for (let i = 0; i < items.length; i += batchSize) {
        yield items.slice(i, i + batchSize);
    }
}
