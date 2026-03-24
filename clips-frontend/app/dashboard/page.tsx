import StatCardGroup from '@/component/Statcardgroup '
import RevenueTrendCard from '@/app/components/RevenueTrendCard'
import DistributionCard from '@/app/components/DistributionCard'

const Dashboard = () => {
    return (
        <div className='w-full max-w-[1920px] mx-auto px-4 py-6'>
            {/* Bento Grid Container */}
            <div className='bento-grid'>
                {/* Stats Cards Row - 3 equal columns on desktop */}
                <StatCardGroup />
                
                {/* Revenue Trend Card - 2/3 width on desktop */}
                <RevenueTrendCard />
                
                {/* Distribution Card - 1/3 width on desktop */}
                <DistributionCard />
            </div>
        </div>
    )
}

export default Dashboard