/**
 * Global utility to rate-limit image requests to avoid 429 errors.
 * Processes a queue of "load" requests with a specific delay between them.
 */

type ImageRequest = {
    src: string;
    onReady: (src: string) => void;
};

class ImageQueue {
    private queue: ImageRequest[] = [];
    private isProcessing = false;
    private delay = 50; // 50ms = 20 requests per second (RPS)

    enqueue(src: string, onReady: (src: string) => void) {
        this.queue.push({ src, onReady });
        if (!this.isProcessing) {
            this.process();
        }
    }

    private async process() {
        if (this.queue.length === 0) {
            this.isProcessing = false;
            return;
        }

        this.isProcessing = true;
        const request = this.queue.shift();

        if (request) {
            // Signal the component that it can now set its src
            request.onReady(request.src);
        }

        // Wait before processing next
        await new Promise(resolve => setTimeout(resolve, this.delay));
        this.process();
    }
}

export const imageQueue = new ImageQueue();
