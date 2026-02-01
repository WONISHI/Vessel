import Logo from '@/assets/vessel.png'
import { Card, CardContent } from '@/components/ui/card'
import { ButtonGroup } from "@/components/ui/button-group"
import { Button } from '@renderer/components/ui/button'

export default function HomePage(): React.JSX.Element {
  return (
    <>
      <Card className="m-auto">
        <CardContent>
          <img src={Logo} className="w-[156px] h-[156px]" />
          <ButtonGroup>
            <Button>导入文件</Button>
            <Button>进入笔记</Button>
          </ButtonGroup>
        </CardContent>
      </Card>
    </>
  )
}
