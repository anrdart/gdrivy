import { useState, useCallback, ClipboardEvent, ChangeEvent, FormEvent } from 'react'
import { FiLink, FiLoader, FiCheck, FiX } from 'react-icons/fi'
import { LinkParserService } from '../services/linkParser'

interface LinkInputProps {
  onLinkSubmit: (link: string) => void
  isLoading: boolean
}

/**
 * LinkInput Component
 * 
 * Input field with paste detection, real-time validation feedback,
 * and submit button with loading state.
 * 
 * Requirements: 5.1, 5.2
 * - THE User_Interface SHALL display a prominent input field for pasting Google Drive links
 * - THE User_Interface SHALL display a download button that is enabled only when a valid link is detected
 */
export function LinkInput({ onLinkSubmit, isLoading }: LinkInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [validationState, setValidationState] = useState<'idle' | 'valid' | 'invalid'>('idle')

  // Validate the input and update validation state
  const validateInput = useCallback((value: string) => {
    if (!value.trim()) {
      setValidationState('idle')
      return
    }
    
    const isValid = LinkParserService.isValidGoogleDriveUrl(value)
    setValidationState(isValid ? 'valid' : 'invalid')
  }, [])

  // Handle input change with real-time validation
  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    validateInput(value)
  }, [validateInput])

  // Handle paste event for automatic detection
  const handlePaste = useCallback((e: ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text')
    // Let the onChange handle the update, but we can do immediate validation
    setTimeout(() => validateInput(pastedText), 0)
  }, [validateInput])

  // Handle form submission
  const handleSubmit = useCallback((e: FormEvent) => {
    e.preventDefault()
    if (validationState === 'valid' && !isLoading) {
      onLinkSubmit(inputValue)
    }
  }, [inputValue, validationState, isLoading, onLinkSubmit])

  // Determine if submit button should be enabled
  // Property 4: Download Button State Consistency
  // For any input string, the download button SHALL be enabled if and only if 
  // the LinkParserService returns a valid ParsedLink object.
  const isSubmitEnabled = validationState === 'valid' && !isLoading

  // Get validation icon based on state
  const getValidationIcon = () => {
    switch (validationState) {
      case 'valid':
        return <FiCheck className="w-5 h-5 text-accent-400" />
      case 'invalid':
        return <FiX className="w-5 h-5 text-red-400" />
      default:
        return <FiLink className="w-5 h-5 text-gray-500" />
    }
  }

  // Get input border/ring color based on validation state
  const getInputStateClasses = () => {
    switch (validationState) {
      case 'valid':
        return 'border-accent-500 focus:border-accent-400 focus:ring-accent-500/20'
      case 'invalid':
        return 'border-red-500 focus:border-red-400 focus:ring-red-500/20'
      default:
        return 'border-surface-700 focus:border-primary-500 focus:ring-primary-500/20'
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="card card-hover">
        <div className="flex flex-col gap-3 sm:gap-4">
          {/* Label */}
          <label htmlFor="drive-link" className="text-sm font-medium text-gray-300">
            Google Drive Link
          </label>
          
          {/* Input field with validation feedback */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
              {getValidationIcon()}
            </div>
            <input
              id="drive-link"
              type="text"
              value={inputValue}
              onChange={handleChange}
              onPaste={handlePaste}
              placeholder="https://drive.google.com/file/d/..."
              className={`
                w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-3 sm:py-3.5 
                bg-surface-900 border-2 rounded-xl 
                text-white text-sm sm:text-base placeholder-gray-500 
                transition-all duration-200
                focus:outline-none focus:ring-4
                touch-target
                ${getInputStateClasses()}
              `}
              disabled={isLoading}
              aria-label="Google Drive link input"
              aria-invalid={validationState === 'invalid'}
              aria-describedby={validationState === 'invalid' ? 'link-error' : undefined}
            />
          </div>

          {/* Validation message */}
          {validationState === 'invalid' && (
            <p id="link-error" className="flex items-center gap-2 text-red-400 text-xs sm:text-sm" role="alert">
              <FiX className="w-4 h-4 flex-shrink-0" />
              Link tidak valid. Pastikan link berasal dari Google Drive.
            </p>
          )}
          
          {validationState === 'valid' && (
            <p className="flex items-center gap-2 text-accent-400 text-xs sm:text-sm">
              <FiCheck className="w-4 h-4 flex-shrink-0" />
              Link valid! Klik tombol di bawah untuk mengambil info file.
            </p>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={!isSubmitEnabled}
            className={`
              w-full py-3 sm:py-3.5 px-4 sm:px-6 rounded-xl font-semibold 
              transition-all duration-200 
              flex items-center justify-center gap-2
              text-sm sm:text-base
              active:scale-[0.98]
              ${isSubmitEnabled
                ? 'btn-primary'
                : 'bg-surface-700 text-gray-500 cursor-not-allowed'
              }
            `}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <>
                <FiLoader className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                <span>Fetching file info...</span>
              </>
            ) : (
              <>
                <FiLink className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Fetch File Info</span>
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  )
}

export default LinkInput
