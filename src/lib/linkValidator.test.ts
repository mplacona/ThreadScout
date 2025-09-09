import { describe, it, expect } from 'vitest';
import { 
  extractLinks, 
  enforceOneLink, 
  enforceAllowlist, 
  validateLinks 
} from './linkValidator';

describe('extractLinks', () => {
  it('should extract HTTP and HTTPS links', () => {
    const text = 'Check out https://example.com and http://test.com for more info';
    const links = extractLinks(text);
    expect(links).toEqual(['https://example.com', 'http://test.com']);
  });

  it('should return empty array for text without links', () => {
    const text = 'This is just plain text without any links';
    const links = extractLinks(text);
    expect(links).toEqual([]);
  });

  it('should handle complex URLs', () => {
    const text = 'Visit https://docs.example.com/api/v1/users?sort=name&limit=10#section1';
    const links = extractLinks(text);
    expect(links).toEqual(['https://docs.example.com/api/v1/users?sort=name&limit=10#section1']);
  });
});

describe('enforceOneLink', () => {
  it('should pass when text has no links', () => {
    const result = enforceOneLink('This is just text');
    expect(result).toEqual({
      ok: true,
      cleaned: 'This is just text',
      count: 0,
    });
  });

  it('should pass when text has exactly one link', () => {
    const text = 'Check out https://example.com for more info';
    const result = enforceOneLink(text);
    expect(result).toEqual({
      ok: true,
      cleaned: text,
      count: 1,
    });
  });

  it('should remove extra links and fail validation', () => {
    const text = 'Check https://example.com and https://test.com and https://another.com';
    const result = enforceOneLink(text);
    
    expect(result.ok).toBe(false);
    expect(result.count).toBe(3);
    expect(result.cleaned).toBe('Check https://example.com and and');
    expect(result.cleaned).not.toContain('https://test.com');
    expect(result.cleaned).not.toContain('https://another.com');
  });
});

describe('enforceAllowlist', () => {
  const allowlist = ['example.com', 'docs.example.com'];

  it('should pass when no links are present', () => {
    const result = enforceAllowlist('Just text', allowlist);
    expect(result).toEqual({
      ok: true,
      cleaned: 'Just text',
      violations: [],
    });
  });

  it('should pass when all links are allowlisted', () => {
    const text = 'Visit https://example.com and https://docs.example.com';
    const result = enforceAllowlist(text, allowlist);
    expect(result).toEqual({
      ok: true,
      cleaned: text,
      violations: [],
    });
  });

  it('should handle www prefix correctly', () => {
    const text = 'Visit https://www.example.com';
    const result = enforceAllowlist(text, allowlist);
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('should handle subdomain matching', () => {
    const text = 'Visit https://api.docs.example.com';
    const result = enforceAllowlist(text, allowlist);
    expect(result.ok).toBe(true);
  });

  it('should remove disallowed links and report violations', () => {
    const text = 'Visit https://example.com and https://badsite.com';
    const result = enforceAllowlist(text, allowlist);
    
    expect(result.ok).toBe(false);
    expect(result.violations).toEqual(['badsite.com']);
    expect(result.cleaned).toBe('Visit https://example.com and');
    expect(result.cleaned).not.toContain('badsite.com');
  });

  it('should handle invalid URLs', () => {
    const text = 'Visit https://example.com and https://invalid-url-format';
    const result = enforceAllowlist(text, allowlist);
    
    expect(result.ok).toBe(false);
    expect(result.violations).toEqual(['invalid-url-format']);
    expect(result.cleaned).toBe('Visit https://example.com and');
  });
});

describe('validateLinks', () => {
  const allowlist = ['example.com'];

  it('should validate text with one allowlisted link', () => {
    const text = 'Check out https://example.com';
    const result = validateLinks(text, allowlist);
    
    expect(result.isValid).toBe(true);
    expect(result.oneLink.ok).toBe(true);
    expect(result.allowlist.ok).toBe(true);
    expect(result.finalText).toBe(text);
  });

  it('should fail validation for multiple links', () => {
    const text = 'Check https://example.com and https://example.com/docs';
    const result = validateLinks(text, allowlist);
    
    expect(result.isValid).toBe(false);
    expect(result.oneLink.ok).toBe(false);
    expect(result.oneLink.count).toBe(2);
  });

  it('should fail validation for disallowed domains', () => {
    const text = 'Check out https://badsite.com';
    const result = validateLinks(text, allowlist);
    
    expect(result.isValid).toBe(false);
    expect(result.allowlist.ok).toBe(false);
    expect(result.allowlist.violations).toEqual(['badsite.com']);
  });

  it('should handle combined violations', () => {
    const text = 'Check https://example.com and https://badsite.com and https://another.com';
    const result = validateLinks(text, allowlist);
    
    expect(result.isValid).toBe(false);
    expect(result.oneLink.ok).toBe(false); // Multiple links
    // After one-link cleaning, only the first link remains (https://example.com)
    // which should pass allowlist validation
    expect(result.allowlist.ok).toBe(true); 
  });
});