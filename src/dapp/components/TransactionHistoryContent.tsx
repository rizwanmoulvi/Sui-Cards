import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit'
import { Text, Flex, Button } from '@radix-ui/themes'
import { useState, useEffect, useCallback } from 'react'
import { 
  RefreshCw, 
  ArrowDown, 
  ArrowUp, 
  Square,
  CreditCard
} from 'lucide-react'
import { SuiEventFilter } from '@mysten/sui/client'
import { useCards } from '../hooks/useCards'
import useNetworkConfig from '~~/hooks/useNetworkConfig'
import { CONTRACT_PACKAGE_VARIABLE_NAME, EXPLORER_URL_VARIABLE_NAME } from '~~/config/network'

// Match the Transaction interface from Dashboard for consistency
interface Transaction {
  id: string;
  digest: string;
  type: string;
  cardId: string;
  timestamp: string;
  amount: string;
}

// Event types for filtering
type EventType = 'deposit' | 'withdraw' | 'spend' | 'transfer' | 'create';

const TransactionHistoryContent = () => {
  const currentAccount = useCurrentAccount()
  const client = useSuiClient()
  const { cards } = useCards()
  const { useNetworkVariable } = useNetworkConfig()
  const packageId = useNetworkVariable(CONTRACT_PACKAGE_VARIABLE_NAME)
  const explorerUrl = useNetworkVariable(EXPLORER_URL_VARIABLE_NAME)
  
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  
  // Fetch transaction data from blockchain
  const fetchTransactionData = useCallback(async () => {
    if (!currentAccount || !packageId || cards.length === 0) return
    
    setLoading(true)
    
    try {
      // Define the event types to query
      const eventTypes = [
        `${packageId}::card::Deposit`,
        `${packageId}::card::Withdraw`,
        `${packageId}::card::Spend`,
        `${packageId}::card::DirectTransfer`,
        `${packageId}::card::CardCreated`
      ]
      
      const allTransactions: Transaction[] = []
      
      // For each event type, fetch events
      for (const eventType of eventTypes) {
        const filter: SuiEventFilter = {
          MoveEventType: eventType
        }
        
        // Fetch events
        const events = await client.queryEvents({
          query: filter,
          limit: 50, // Get the last 50 events
          order: 'descending'
        })
        
        // Process each event
        for (const event of events.data) {
          const parsedJson = event.parsedJson as any
          const eventCardId = parsedJson?.card_id
          
          // Skip if not related to our cards
          if (eventCardId && !cards.some(card => card.id === eventCardId)) {
            continue
          }
          
          // Determine event type
          const txType = 
            eventType.includes('Deposit') ? 'deposit'
            : eventType.includes('Withdraw') ? 'withdraw'
            : eventType.includes('Spend') ? 'spend'
            : eventType.includes('DirectTransfer') ? 'transfer'
            : 'create'
          
          // Get amount in SUI (converted from MIST)
          const amountMist = parsedJson?.amount || '0'
          const amountSui = (Number(amountMist) / 1_000_000_000).toFixed(4)
          
          // Create transaction item
          const transaction: Transaction = {
            id: event.id.txDigest + event.id.eventSeq,
            digest: event.id.txDigest,
            type: txType,
            cardId: eventCardId || '',
            timestamp: event.timestampMs || Date.now().toString(),
            amount: amountSui
          }
          
          allTransactions.push(transaction)
        }
      }
      
      // Sort transactions by timestamp (newest first)
      allTransactions.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      
      // Update state with the transactions
      setTransactions(allTransactions)
      console.log('Fetched transactions:', allTransactions.length)
      
    } catch (error) {
      console.error('Error fetching transaction data:', error)
    } finally {
      setLoading(false)
    }
  }, [currentAccount, client, packageId, cards])
  
  // Initial fetch on component mount
  useEffect(() => {
    fetchTransactionData()
  }, [fetchTransactionData])

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return <ArrowDown size={20} className="text-green-400" />
      case 'withdraw':
        return <ArrowUp size={20} className="text-red-400" />
      case 'spend':
        return <ArrowUp size={20} className="text-orange-400" />
      case 'transfer':
        return <ArrowUp size={20} className="text-amber-400" />
      case 'create':
        return <CreditCard size={20} className="text-blue-400" />
      default:
        return <Square size={20} className="text-gray-400" />
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return new Intl.DateTimeFormat('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  const handleRefresh = () => {
    // Fetch latest transactions
    fetchTransactionData()
  }

  const formatTransactionType = (type: string) => {
    switch (type) {
      case 'create':
        return 'Card Created'
      case 'transfer':
        return 'Transfer'
      case 'withdraw':
        return 'Withdrawal'
      default:
        return type.charAt(0).toUpperCase() + type.slice(1)
    }
  }
  
  // Get card number based on card ID
  const getCardNumber = (cardId: string) => {
    const cardIndex = cards.findIndex(card => card.id === cardId)
    return cardIndex !== -1 ? `#${cardIndex}` : 'Unknown'
  }
  
  const getTransactionDescription = (tx: Transaction) => {
    const cardNumber = getCardNumber(tx.cardId)
    
    switch (tx.type) {
      case 'deposit':
        return `${tx.amount} SUI deposited to Card ${cardNumber}`
      case 'withdraw':
        return `${tx.amount} SUI withdrawn from Card ${cardNumber}`
      case 'spend':
        return `${tx.amount} SUI spent from Card ${cardNumber}`
      case 'transfer':
        return `${tx.amount} SUI transferred from Card ${cardNumber}`
      case 'create':
        return `Card ${cardNumber} created`
      default:
        return `Transaction on Card ${cardNumber}`
    }
  }

  if (!currentAccount) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <Text className="mb-4 text-white/70">Connect your wallet to view transaction history</Text>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gradient-to-br from-red-900 to-red-950 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <Text size="8" className="text-white font-bold">Transaction History</Text>
        <Button 
          onClick={handleRefresh} 
          variant="soft"
          className="bg-white/10 hover:bg-white/20 text-white"
          disabled={loading}
        >
          {loading ? (
            <>
              <RefreshCw size={16} className="animate-spin mr-2" />
              Loading...
            </>
          ) : (
            <>
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </>
          )}
        </Button>
      </div>

      {/* Transactions List */}
      <div className="space-y-4">
        {loading && transactions.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10 text-center">
            <Text className="text-white/70">Loading transactions...</Text>
          </div>
        ) : transactions.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10 text-center">
            <Text className="text-white/70">No transactions found</Text>
          </div>
        ) : (
          transactions.map((tx) => (
            <div 
              key={tx.id} 
              className="bg-white/5 backdrop-blur-sm rounded-xl p-5 border border-white/10 hover:bg-white/10 transition-colors"
            >
              <Flex justify="between" align="center">
                <Flex gap="3" align="center">
                  <div className={`p-2 rounded-full ${tx.type === 'spend' || tx.type === 'withdraw' || tx.type === 'transfer' ? 'bg-red-800/50' : 'bg-green-800/50'}`}>
                    {getTransactionIcon(tx.type)}
                  </div>
                  
                  <div>
                    <Text className="text-white font-medium">
                      {formatTransactionType(tx.type)}
                    </Text>
                    <Text size="2" className="text-white/80">
                      {getTransactionDescription(tx)}
                    </Text>
                  </div>
                </Flex>
                
                <div className="text-right">
                  <Text className="text-white/80">
                    {formatTimestamp(tx.timestamp)}
                  </Text>
                  <a 
                    href={`${explorerUrl}/txblock/${tx.digest}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:underline"
                  >
                    View in Explorer
                  </a>
                </div>
              </Flex>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default TransactionHistoryContent
