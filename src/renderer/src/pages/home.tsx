import Logo from '@/assets/vessel.png'
import { Card, CardContent } from '@/components/ui/card'

export default function HomePage(): React.JSX.Element {
  return (
    <>
      <Card className="m-auto">
        <CardContent>
          <img src={Logo} className="w-[156px] h-[156px]" />
        </CardContent>
      </Card>
    </>
  )
}
