import { useState, useEffect, useRef, useCallback } from 'react';
import { Editor } from '@tiptap/react';

interface SpellcheckResult {
  offset: number;
  token: string;
  type: string;
  suggestions: string[];
  editId?: string; // Added to support accepting/rejecting
}

interface SpellcheckResponse {
  errors: SpellcheckResult[];
}

interface CachedResult {
  errors: SpellcheckResult[];
  timestamp: number;
}

interface IgnoredError {
  id: number;
  user_id: number;
  token: string;
  type: string;
  created_at: string;
}

// Cache configuration
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const DEBOUNCE_DELAY = 5000; // 5 seconds
const MIN_CONTENT_LENGTH = 20; // Minimum content length to trigger check
const MAX_CACHE_ITEMS = 50; // Maximum number of items to keep in cache

export function useSpellcheck(editor: Editor | null) {
  const [isChecking, setIsChecking] = useState(false);
  const [errors, setErrors] = useState<SpellcheckResult[]>([]);
  const [ignoredErrors, setIgnoredErrors] = useState<IgnoredError[]>([]);
  const [lastCheckedContent, setLastCheckedContent] = useState<string>('');
  const [lastCheckedHash, setLastCheckedHash] = useState<string>('');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

  // Add a ref to track if ignored errors list has changed since last check
  const ignoredErrorsRef = useRef<string>('');

  // Filter errors that have been ignored
  const filterIgnoredErrors = useCallback((errors: SpellcheckResult[]): SpellcheckResult[] => {
    return errors.filter(error =>
      !ignoredErrors.some(ignored =>
        ignored.token === error.token && ignored.type === error.type
      )
    );
  }, [ignoredErrors]);

  // Load ignored errors from API on component mount
  useEffect(() => {
    loadIgnoredErrors();
  }, []);

  // Load cache from local storage
  const getCache = useCallback(() => {
    try {
      const cacheJson = localStorage.getItem('spellcheck_cache');
      if (cacheJson) {
        return JSON.parse(cacheJson) as Record<string, CachedResult>;
      }
    } catch (e) {
      console.warn('Failed to load spellcheck cache:', e);
    }
    return {} as Record<string, CachedResult>;
  }, []);

  // Save cache to local storage
  const saveCache = useCallback((cache: Record<string, CachedResult>) => {
    try {
      localStorage.setItem('spellcheck_cache', JSON.stringify(cache));
    } catch (e) {
      console.warn('Failed to save spellcheck cache:', e);
    }
  }, []);

  // Update all cached results to respect current ignored errors
  const updateCacheWithIgnoredErrors = useCallback(() => {
    try {
      const cache = getCache();
      const updatedCache: Record<string, CachedResult> = {};

      // Apply the current ignored errors list to each cached result
      Object.entries(cache).forEach(([key, value]) => {
        updatedCache[key] = {
          ...value,
          errors: filterIgnoredErrors(value.errors)
        };
      });

      saveCache(updatedCache);
      console.log('Updated cache with current ignored errors');
    } catch (e) {
      console.warn('Failed to update cache with ignored errors:', e);
    }
  }, [getCache, saveCache, filterIgnoredErrors]);

  // Update ignoredErrorsRef and cache when ignoredErrors change
  useEffect(() => {
    // Create a fingerprint of the ignored errors to detect changes
    const errorFingerprint = ignoredErrors
      .map(err => `${err.token}:${err.type}`)
      .sort()
      .join('|');

    // Only update if the fingerprint has changed
    if (errorFingerprint !== ignoredErrorsRef.current) {
      ignoredErrorsRef.current = errorFingerprint;

      // Update cache with new ignored errors
      updateCacheWithIgnoredErrors();

      // Clear cache hash to force a refresh next time
      setLastCheckedHash('');
    }
  }, [ignoredErrors, updateCacheWithIgnoredErrors]);

  // Load ignored errors from API
  const loadIgnoredErrors = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('No authentication token found for loading ignored errors');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/content/spellcheck/ignored`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include' // Include cookies for session authentication
      });

      if (!response.ok) {
        throw new Error(`Failed to load ignored errors: ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.ignoredErrors) {
        const prevIgnoredCount = ignoredErrors.length;
        setIgnoredErrors(data.ignoredErrors);
        console.log(`Loaded ${data.ignoredErrors.length} ignored spelling/grammar errors from server`);

        // If we already have content checked and the ignored errors list changed,
        // we should reapply the filter to current errors
        if (lastCheckedContent && prevIgnoredCount !== data.ignoredErrors.length) {
          console.log('Ignored errors list changed, updating current errors');

          // Filter current errors against the new ignored list
          setErrors(prev => filterIgnoredErrors(prev));

          // Clear the hash to force a fresh check next time
          setLastCheckedHash('');
        }
      }
    } catch (e) {
      console.warn('Failed to load ignored errors:', e);
    }
  }, [API_BASE_URL, filterIgnoredErrors, ignoredErrors.length, lastCheckedContent]);

  // Add an error to the ignored list
  const addToIgnored = useCallback(async (error: SpellcheckResult) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('No authentication token found for adding ignored error');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/content/spellcheck/ignored`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include', // Include cookies for session authentication
        body: JSON.stringify({
          token: error.token,
          type: error.type
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to add ignored error: ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.ignoredError) {
        // Add to state
        setIgnoredErrors(prev => {
          // Check if already exists to avoid duplicates
          const exists = prev.some(e => e.token === error.token && e.type === error.type);
          if (exists) return prev;
          return [...prev, data.ignoredError];
        });

        // Remove this error from current errors
        setErrors(prev => prev.filter(e => !(e.token === error.token && e.type === error.type)));

        // Update all cached results to remove this error
        try {
          const cache = getCache();
          let cacheUpdated = false;

          // Go through all cache entries and remove this error
          Object.entries(cache).forEach(([key, value]) => {
            const originalErrorCount = value.errors.length;

            // Filter out the newly ignored error from this cache entry
            const updatedErrors = value.errors.filter(
              e => !(e.token === error.token && e.type === error.type)
            );

            // Only update if we actually removed something
            if (updatedErrors.length !== originalErrorCount) {
              cache[key] = {
                ...value,
                errors: updatedErrors,
                timestamp: Date.now() // Refresh timestamp
              };
              cacheUpdated = true;
            }
          });

          if (cacheUpdated) {
            saveCache(cache);
            console.log('Updated all cached results after adding ignored error');
          }
        } catch (e) {
          console.warn('Error updating cache after adding ignored error:', e);
        }
      }
    } catch (e) {
      console.warn('Failed to add ignored error:', e);
    }
  }, [API_BASE_URL]);

  // Remove an error from the ignored list
  const removeFromIgnored = useCallback(async (id: number) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('No authentication token found for removing ignored error');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/content/spellcheck/ignored/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include' // Include cookies for session authentication
      });

      if (!response.ok) {
        throw new Error(`Failed to remove ignored error: ${response.status}`);
      }

      // Update local state after successful API call
      setIgnoredErrors(prev => prev.filter(e => e.id !== id));
    } catch (e) {
      console.warn('Failed to remove ignored error:', e);
    }
  }, [API_BASE_URL]);

  // Clear all ignored errors
  const clearAllIgnored = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('No authentication token found for clearing ignored errors');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/content/spellcheck/ignored`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include' // Include cookies for session authentication
      });

      if (!response.ok) {
        throw new Error(`Failed to clear ignored errors: ${response.status}`);
      }

      // Clear local state after successful API call
      setIgnoredErrors([]);
    } catch (e) {
      console.warn('Failed to clear ignored errors:', e);
    }
  }, [API_BASE_URL]);

  // Clear timer when component unmounts
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Simple hash function for text
  const hashText = useCallback((text: string): string => {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }, []);

  // Clean old entries from cache
  const cleanCache = useCallback((cache: Record<string, CachedResult>) => {
    const now = Date.now();
    const entries = Object.entries(cache);

    // Remove expired entries
    const validEntries = entries.filter(([, value]) => {
      return now - value.timestamp < CACHE_TTL;
    });

    // If still too many entries, keep only the most recent ones
    if (validEntries.length > MAX_CACHE_ITEMS) {
      validEntries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      validEntries.splice(MAX_CACHE_ITEMS);
    }

    return Object.fromEntries(validEntries);
  }, []);

  // Function to get only changed paragraphs from content
  const getChangedParagraphs = useCallback((newContent: string): string => {
    if (!lastCheckedContent) return newContent;

    // Simple implementation - in real app, would need to compare paragraphs
    // and only return changed ones for optimization
    if (newContent === lastCheckedContent) return '';

    return newContent;
  }, [lastCheckedContent]);

  // Extract plain text from HTML content
  const extractPlainText = useCallback((html: string): string => {
    // Simple HTML to text - in a real app, use a proper HTML parser
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }, []);

  // Perform the actual spellcheck API call
  const performSpellcheck = useCallback(async (content: string) => {
    // Extract plain text for better caching and comparison
    const plainText = extractPlainText(content);

    // Check minimum length requirement
    if (plainText.length < MIN_CONTENT_LENGTH) {
      console.log(`Content too short (${plainText.length} chars), skipping spellcheck`);
      setErrors([]);
      return;
    }

    // Generate a hash of the content for cache lookup
    const contentHash = hashText(plainText);

    // Create a fingerprint of the current ignored errors
    const currentIgnoredErrorsFingerprint = ignoredErrors
      .map(err => `${err.token}:${err.type}`)
      .sort()
      .join('|');

    // Skip if content hasn't changed substantially and ignored errors list hasn't changed
    if (contentHash === lastCheckedHash && currentIgnoredErrorsFingerprint === ignoredErrorsRef.current) {
      console.log('Content and ignored errors unchanged, skipping spellcheck');
      return;
    }

    // Check cache before making API call
    const cache = getCache();
    const cachedResult = cache[contentHash];

    if (cachedResult && (Date.now() - cachedResult.timestamp < CACHE_TTL)) {
      console.log('Using cached spellcheck result from',
        new Date(cachedResult.timestamp).toLocaleTimeString());

      // Apply current ignored errors filter to cached results
      const filteredErrors = filterIgnoredErrors(cachedResult.errors);
      setErrors(filteredErrors);
      setLastCheckedContent(content);
      setLastCheckedHash(contentHash);
      return;
    }

    setIsChecking(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('No authentication token found for spellcheck');
        return;
      }

      console.log('Sending content for spellcheck:', plainText.substring(0, 100) + '...');

      const response = await fetch(`${API_BASE_URL}/api/content/spellcheck`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include', // Include cookies for session authentication
        body: JSON.stringify({ text: content })
      });

      if (!response.ok) {
        throw new Error(`Spellcheck API error: ${response.status}`);
      }

      const data: SpellcheckResponse = await response.json();

      // Log the errors we received
      console.log('Received spellcheck errors:', data.errors);

      // Make sure we have valid errors to display
      let validErrors: SpellcheckResult[] = [];
      if (data.errors && data.errors.length > 0) {
        // Validate each error has the required fields
        validErrors = data.errors.filter(error => {
          const isValid = !!error.token && typeof error.offset === 'number';
          if (!isValid) {
            console.warn('Invalid error received:', error);
          }
          return isValid;
        });

        // Double check that no ignored errors are included in the response
        // This is a client-side safety check in case the server didn't filter properly
        validErrors = filterIgnoredErrors(validErrors);

        console.log(`Filtered ${data.errors.length - validErrors.length} ignored errors client-side`);

        setErrors(validErrors);
      } else {
        setErrors([]);
      }

      // Update the cache with the new result
      const updatedCache = cleanCache({
        ...cache,
        [contentHash]: {
          errors: validErrors, // Store errors in cache
          timestamp: Date.now()
        }
      });
      saveCache(updatedCache);

      // Store the content we just checked
      setLastCheckedContent(content);
      setLastCheckedHash(contentHash);
    } catch (error) {
      console.error('Spellcheck error:', error);
    } finally {
      setIsChecking(false);
    }
  }, [API_BASE_URL, extractPlainText, hashText, lastCheckedHash, ignoredErrors, ignoredErrorsRef, getCache, cleanCache, saveCache, filterIgnoredErrors]);

  // Accept a suggestion from Sapling
  const acceptSuggestion = useCallback(async (errorOffset: number, suggestion: string) => {
    // Find the error with this offset
    const error = errors.find(err => err.offset === errorOffset);

    if (!error || !error.editId) {
      console.warn('Cannot accept suggestion: no edit ID found for error at offset', errorOffset);
      return false;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('No authentication token found for accepting suggestion');
        return false;
      }

      // Log which suggestion was accepted (for debugging/analytics)
      console.log(`Accepting suggestion "${suggestion}" for error "${error.token}"`);

      const response = await fetch(`${API_BASE_URL}/api/content/spellcheck/accept/${error.editId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include' // Include cookies for session authentication
      });

      return response.ok;
    } catch (error) {
      console.error('Error accepting suggestion:', error);
      return false;
    }
  }, [API_BASE_URL, errors]);

  // Reject a suggestion from Sapling
  const rejectSuggestion = useCallback(async (errorOffset: number) => {
    // Find the error with this offset
    const error = errors.find(err => err.offset === errorOffset);

    if (!error || !error.editId) {
      console.warn('Cannot reject suggestion: no edit ID found for error at offset', errorOffset);
      return false;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('No authentication token found for rejecting suggestion');
        return false;
      }

      const response = await fetch(`${API_BASE_URL}/api/content/spellcheck/reject/${error.editId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include' // Include cookies for session authentication
      });

      // Add this error to the ignored list when user rejects it
      await addToIgnored(error);

      // Remove this error from the local errors list
      if (response.ok) {
        setErrors(prev => prev.filter(err => err.offset !== errorOffset));

        // Update cache to remove this error
        try {
          const contentHash = lastCheckedHash;
          if (contentHash) {
            const cache = getCache();
            const cachedResult = cache[contentHash];

            if (cachedResult) {
              // Remove the rejected error which is now in ignored list
              const updatedErrors = cachedResult.errors
                .filter(err => !(err.offset === errorOffset ||
                  // Also filter out any other instances of this error token/type
                  (err.token === error.token && err.type === error.type)
                ));

              // Update the cache with filtered errors
              cache[contentHash] = {
                ...cachedResult,
                errors: updatedErrors,
                timestamp: Date.now() // Update timestamp to extend cache life
              };

              saveCache(cache);
              console.log('Updated cache after rejecting suggestion');
            }
          }
        } catch (e) {
          console.warn('Error updating cache after rejecting suggestion:', e);
        }
      }

      return response.ok;
    } catch (error) {
      console.error('Error rejecting suggestion:', error);
      return false;
    }
  }, [API_BASE_URL, errors, addToIgnored]);

  // Debounced spellcheck function
  const checkSpelling = useCallback((force = false) => {
    if (!editor) return;

    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const content = editor.getHTML();
    const contentToCheck = getChangedParagraphs(content);

    // If no changes or empty content, skip check
    if (!contentToCheck && !force) return;

    // If force is true, check immediately and clear the hash to avoid using cache
    if (force) {
      // Clear the hash to force a fresh check from the server
      setLastCheckedHash('');
      performSpellcheck(content);
    } else {
      debounceTimerRef.current = setTimeout(() => {
        performSpellcheck(content);
      }, DEBOUNCE_DELAY); // Use configurable debounce time
    }
  }, [editor, getChangedParagraphs, performSpellcheck]);

  // Apply a suggested correction
  const applySuggestion = useCallback(async (errorOffset: number, suggestion: string) => {
    if (!editor) return;

    console.log(`Applying suggestion at offset ${errorOffset}: ${suggestion}`);

    // Find the error with this offset
    const error = errors.find(err => err.offset === errorOffset);
    if (!error) {
      console.warn('Cannot apply suggestion: error not found for offset', errorOffset);
      return;
    }

    // Find the error in the document by looking for its decoration
    try {
      // Method 1: Look for the decoration element in the DOM
      const errorElements = editor.view.dom.querySelectorAll('.spellcheck-error');
      let targetFrom = -1;
      let targetTo = -1;

      // Iterate through all error elements to find the one with our error
      for (const element of Array.from(errorElements)) {
        try {
          const errorData = element.getAttribute('data-spellcheck-error');
          if (!errorData) continue;

          const decoError = JSON.parse(errorData);
          if (decoError.offset === errorOffset) {
            // Get position from the DOM
            const pos = editor.view.posAtDOM(element, 0);
            if (pos !== undefined) {
              // Get a range for the entire decoration
              const nodeSize = element.textContent?.length || 0;
              targetFrom = pos;
              targetTo = pos + nodeSize;
              break;
            }
          }
        } catch (e) {
          console.warn('Error parsing decoration data:', e);
        }
      }

      // Method 2: If DOM approach fails, search for the error text in the document
      if (targetFrom === -1) {
        console.log('Falling back to text search for error:', error.token);

        // Normalize content for better search
        const errorToken = error.token.trim();
        if (!errorToken) {
          console.warn('Empty error token');
          return;
        }

        // Search through text nodes to find the error
        let found = false;
        editor.state.doc.descendants((node, pos) => {
          if (found || !node.isText) return false;

          const text = node.text || '';
          const errorIndex = text.indexOf(errorToken);

          if (errorIndex >= 0) {
            // Found the error in this text node
            targetFrom = pos + errorIndex;
            targetTo = targetFrom + errorToken.length;
            found = true;
            return false; // Stop searching
          }

          return true; // Continue searching
        });
      }

      // Method 3: If all else fails, try a broader approach, searching for partial matches
      if (targetFrom === -1 && error.token.length > 3) {
        console.log('Trying partial match for:', error.token);

        // Get the longest word in the error token
        const words = error.token.split(/\s+/).filter(w => w.length > 2);
        if (words.length > 0) {
          // Sort by length descending to get most distinctive words first
          words.sort((a, b) => b.length - a.length);

          for (const word of words) {
            let found = false;

            editor.state.doc.descendants((node, pos) => {
              if (found || !node.isText) return false;

              const text = node.text || '';
              const wordIndex = text.indexOf(word);

              if (wordIndex >= 0) {
                // Found a word - now estimate the span
                const context = 15; // Characters to include around the word
                const start = Math.max(0, wordIndex - context);
                const end = Math.min(text.length, wordIndex + word.length + context);

                targetFrom = pos + start;
                targetTo = pos + end;
                found = true;
                return false;
              }

              return true;
            });

            if (found) break;
          }
        }
      }

      // If we found a position, replace the text
      if (targetFrom !== -1 && targetTo !== -1) {
        console.log(`Replacing text at positions ${targetFrom}-${targetTo} with "${suggestion}"`);

        editor.chain()
          .focus()
          .deleteRange({ from: targetFrom, to: targetTo })
          .insertContentAt(targetFrom, suggestion)
          .run();
      } else {
        console.error('Could not find error position in document for:', error.token);
        return;
      }
    } catch (e) {
      console.error('Error applying suggestion:', e);
      return;
    }

    // Send accept feedback to the API
    await acceptSuggestion(errorOffset, suggestion);

    // Remove this error from our local list
    setErrors(prev => prev.filter(err => err.offset !== errorOffset));

    // Update cache to remove this error and any ignored errors
    try {
      const contentHash = lastCheckedHash;
      if (contentHash) {
        const cache = getCache();
        const cachedResult = cache[contentHash];

        if (cachedResult) {
          // Remove the accepted error and reapply ignored errors filter
          const updatedErrors = cachedResult.errors
            .filter(err => err.offset !== errorOffset) // Remove the accepted error
            .filter(error => // Filter out all ignored errors
              !ignoredErrors.some(ignored =>
                ignored.token === error.token && ignored.type === error.type
              )
            );

          // Update the cache with filtered errors
          cache[contentHash] = {
            ...cachedResult,
            errors: updatedErrors,
            timestamp: Date.now() // Update timestamp to extend cache life
          };

          saveCache(cache);
          console.log('Updated cache after accepting suggestion');
        }
      }
    } catch (e) {
      console.warn('Error updating cache after accepting suggestion:', e);
    }

    // Don't immediately re-run spellcheck - wait for the automatic debounced check
    // This saves an API call and is more cost-effective
  }, [editor, errors, acceptSuggestion]);

  // Clear all spellcheck errors
  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  // Manual cache clearing function
  const clearCache = useCallback(() => {
    try {
      localStorage.removeItem('spellcheck_cache');
      console.log('Spellcheck cache cleared');
    } catch (e) {
      console.error('Error clearing spellcheck cache:', e);
    }
  }, []);

  return {
    isChecking,
    errors,
    ignoredErrors,
    checkSpelling,
    applySuggestion,
    rejectSuggestion,
    clearErrors,
    clearCache,
    addToIgnored,
    removeFromIgnored,
    clearAllIgnored
  };
} 