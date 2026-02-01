import Logo from '@/assets/vessel.png'
import { Card, CardContent } from '@/components/ui/card'
import { ButtonGroup } from "@/components/ui/button-group"
import { Button } from '@renderer/components/ui/button'
import { useState } from "react"

export default function HomePage(): React.JSX.Element {
  const [path, setPath] = useState<string | null>(null);

  const handleOpenFolder = async () => {
    // 调用 preload 暴露的方法
    const selectedPath = await window.electronAPI.openDirectory();
    console.log(selectedPath)
    if (selectedPath) {
      setPath(selectedPath);
      console.log("用户选择了目录:", selectedPath);
    }
  };

  return (
    <>
      <Card className="m-auto">
        <CardContent>
          <img src={Logo} className="w-[156px] h-[156px]" />
          <ButtonGroup>
            <Button onClick={handleOpenFolder}>导入文件</Button>
            <Button>进入笔记</Button>
          </ButtonGroup>
        </CardContent>
      </Card>
    </>
  )
}
