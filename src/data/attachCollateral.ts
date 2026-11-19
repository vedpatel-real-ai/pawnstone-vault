import type { DataProvider } from './dataProvider'

export async function attachCollateral(provider: DataProvider, orgId:string, loanId:string, file:File) {
  const ext = file.name.split('.').pop()?.replace(/[^a-z0-9]/gi,'') || 'jpg'
  const path = await provider.storage.upload('loan_assets',loanId + '/' + crypto.randomUUID() + '.' + ext,file,{contentType:file.type})
  try {
    return await provider.loanAssets.add({org_id:orgId,loan_id:loanId,file_url:path,file_name:file.name,file_size:file.size})
  } catch (error) {
    // A lost acknowledgement can leave committed metadata. Check it before deleting the object.
    const existing = (await provider.loanAssets.list(loanId)).find(asset => asset.file_url === path)
    if (existing) return existing
    await provider.storage.remove('loan_assets',[path])
    throw error
  }
}
